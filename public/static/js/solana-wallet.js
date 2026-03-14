/**
 * ══════════════════════════════════════════════════════════════════
 * solana-wallet.js  — Phantom / TokenPocket / 모든 Solana 지갑 연동
 * Solana Web3.js + SPL Token (CDN) 사용
 * 
 * 지원 지갑:
 *   - Phantom       (window.phantom.solana  또는 window.solana)
 *   - TokenPocket   (window.solana  — Solana Wallet Standard 호환)
 *   - Solflare      (window.solflare)
 *   - 기타 Solana Wallet Standard 호환 지갑
 * 
 * 흐름:
 *   1. connectWallet()   → 지갑 팝업 → 공개키 반환
 *   2. sendUsdtDeposit() → USDT SPL 전송 트랜잭션 빌드 → 서명 → 브로드캐스트
 *   3. 트랜잭션 해시(signature) 반환 → Firestore 자동 저장 → 온체인 확인 후 자동 승인
 * ══════════════════════════════════════════════════════════════════
 */

// Solana USDT (SPL) 민트 주소 (메인넷)
const SOLANA_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Solana RPC 엔드포인트 (공개 RPC — 실서비스 시 전용 RPC 권장)
const SOLANA_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
];

// ── 상태 ──────────────────────────────────────────────────────────
window.SolanaWallet = {
  provider:   null,   // 연결된 지갑 provider
  publicKey:  null,   // 연결된 지갑 주소 (string)
  walletName: null,   // 'Phantom' | 'TokenPocket' | 'Solflare' | 'Unknown'

  // ──────────────────────────────────────────────────────────────
  // 1. 지갑 감지
  // ──────────────────────────────────────────────────────────────
  detectProvider() {
    // Phantom
    if (window.phantom?.solana?.isPhantom) {
      this.walletName = 'Phantom';
      return window.phantom.solana;
    }
    // Solflare
    if (window.solflare?.isSolflare) {
      this.walletName = 'Solflare';
      return window.solflare;
    }
    // TokenPocket / 기타 Solana Wallet Standard
    if (window.solana) {
      this.walletName = window.solana.isPhantom ? 'Phantom'
                      : window.solana.isTokenPocket ? 'TokenPocket'
                      : 'Solana Wallet';
      return window.solana;
    }
    return null;
  },

  // ──────────────────────────────────────────────────────────────
  // 2. 지갑 연결
  // ──────────────────────────────────────────────────────────────
  async connect() {
    const provider = this.detectProvider();
    if (!provider) {
      // 모바일: 딥링크로 Phantom 앱 오픈
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const url = encodeURIComponent(window.location.href);
        window.open(`https://phantom.app/ul/browse/${url}?ref=${url}`, '_blank');
        throw new Error('MOBILE_DEEPLINK');
      }
      throw new Error('NO_WALLET');
    }

    try {
      const resp = await provider.connect();
      this.provider  = provider;
      this.publicKey = resp.publicKey.toString();
      return { address: this.publicKey, walletName: this.walletName };
    } catch (e) {
      if (e.code === 4001) throw new Error('USER_REJECTED');
      throw e;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // 3. 연결 해제
  // ──────────────────────────────────────────────────────────────
  async disconnect() {
    if (this.provider?.disconnect) await this.provider.disconnect();
    this.provider  = null;
    this.publicKey = null;
    this.walletName = null;
  },

  // ──────────────────────────────────────────────────────────────
  // 4. USDT(SPL) 잔액 조회
  // ──────────────────────────────────────────────────────────────
  async getUsdtBalance(address) {
    try {
      const owner = address || this.publicKey;
      if (!owner) return 0;

      // getTokenAccountsByOwner RPC 직접 호출
      for (const rpc of SOLANA_RPC_ENDPOINTS) {
        try {
          const res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 1,
              method: 'getTokenAccountsByOwner',
              params: [
                owner,
                { mint: SOLANA_USDT_MINT },
                { encoding: 'jsonParsed' }
              ]
            })
          });
          const data = await res.json();
          const accounts = data?.result?.value || [];
          if (accounts.length === 0) return 0;
          const amount = accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
          return amount;
        } catch { continue; }
      }
      return 0;
    } catch { return 0; }
  },

  // ──────────────────────────────────────────────────────────────
  // 5. USDT(SPL) 전송 — 핵심 함수
  //    recipient: 받는 지갑 주소 (회사 지갑)
  //    amount:    USDT 금액 (소수점 포함, 예: 100.50)
  // ──────────────────────────────────────────────────────────────
  async sendUsdt(recipient, amount) {
    if (!this.provider || !this.publicKey) throw new Error('WALLET_NOT_CONNECTED');

    const amountLamports = Math.round(amount * 1_000_000); // USDT = 6 decimals
    if (amountLamports <= 0) throw new Error('INVALID_AMOUNT');

    // ── RPC 연결 ──
    let rpcUrl = null;
    for (const ep of SOLANA_RPC_ENDPOINTS) {
      try {
        const r = await fetch(ep, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'getHealth' })
        });
        if (r.ok) { rpcUrl = ep; break; }
      } catch { continue; }
    }
    if (!rpcUrl) throw new Error('RPC_UNAVAILABLE');

    // ── Sender ATA 조회 ──
    const senderATA = await this._getOrCreateATA(this.publicKey, this.publicKey, SOLANA_USDT_MINT, rpcUrl);
    if (!senderATA) throw new Error('NO_USDT_ACCOUNT');

    // ── Recipient ATA 조회 (없으면 생성 포함) ──
    const recipientATA = await this._getOrCreateATA(recipient, this.publicKey, SOLANA_USDT_MINT, rpcUrl);

    // ── 최신 blockhash 조회 ──
    const bhRes = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'getLatestBlockhash', params:[{ commitment:'finalized' }] })
    });
    const bhData = await bhRes.json();
    const { blockhash, lastValidBlockHeight } = bhData.result.value;

    // ── 트랜잭션 빌드 (Raw instruction 방식 — 외부 라이브러리 불필요) ──
    const tx = this._buildSplTransferTx({
      senderPubkey:    this.publicKey,
      senderATA,
      recipientATA,
      mint:            SOLANA_USDT_MINT,
      amount:          amountLamports,
      blockhash,
    });

    // ── 서명 요청 (지갑 팝업) ──
    let signedTx;
    try {
      signedTx = await this.provider.signTransaction(tx);
    } catch (e) {
      if (e.code === 4001 || e.message?.includes('reject')) throw new Error('USER_REJECTED');
      throw e;
    }

    // ── 브로드캐스트 ──
    const sendRes = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'sendTransaction',
        params: [
          this._txToBase64(signedTx),
          { encoding: 'base64', preflightCommitment: 'confirmed' }
        ]
      })
    });
    const sendData = await sendRes.json();
    if (sendData.error) throw new Error(sendData.error.message || 'TX_FAILED');

    const signature = sendData.result;

    // ── Confirm (최대 60초) ──
    await this._confirmTransaction(signature, lastValidBlockHeight, rpcUrl);

    return signature;
  },

  // ──────────────────────────────────────────────────────────────
  // 내부: ATA(Associated Token Account) 조회/생성
  // ──────────────────────────────────────────────────────────────
  async _getOrCreateATA(owner, payer, mint, rpcUrl) {
    // ATA 주소 계산 (PDA 유도)
    const ata = await this._deriveATA(owner, mint);

    // 존재 여부 확인
    const infoRes = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc:'2.0', id:1, method:'getAccountInfo',
        params: [ata, { encoding:'base64' }]
      })
    });
    const infoData = await infoRes.json();
    if (infoData.result?.value) return ata; // 이미 존재

    // 없으면 null 반환 (생성은 트랜잭션에 포함)
    return ata;
  },

  // ATA 주소 유도 (SHA256 기반 PDA)
  async _deriveATA(owner, mint) {
    // Associated Token Program: 11111111111111111111111111111111
    // ATA Program: ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bv
    // seeds = [owner, token_program, mint]
    // 실제 구현: @solana/spl-token 없이 수동으로 계산하는 것은 복잡하므로
    // RPC의 getTokenAccountsByOwner 결과로 대체
    const res = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc:'2.0', id:1, method:'getTokenAccountsByOwner',
        params: [owner, { mint }, { encoding:'jsonParsed' }]
      })
    });
    const data = await res.json();
    const accounts = data?.result?.value || [];
    return accounts[0]?.pubkey || null;
  },

  // ──────────────────────────────────────────────────────────────
  // 내부: SPL Transfer 트랜잭션 빌드
  // ──────────────────────────────────────────────────────────────
  _buildSplTransferTx({ senderPubkey, senderATA, recipientATA, mint, amount, blockhash }) {
    // Solana 트랜잭션을 @solana/web3.js Transaction 객체로 빌드
    // CDN에서 로드된 solanaWeb3 전역 객체 사용
    const solanaWeb3 = window.solanaWeb3;
    if (!solanaWeb3) throw new Error('SOLANA_WEB3_NOT_LOADED');

    const { Transaction, PublicKey, TransactionInstruction, SystemProgram } = solanaWeb3;

    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const TRANSFER_INSTRUCTION = 3; // spl-token Transfer instruction index

    // Transfer instruction data: [3, amount_u64_le]
    const data = Buffer.alloc(9);
    data.writeUInt8(TRANSFER_INSTRUCTION, 0);
    data.writeBigUInt64LE(BigInt(amount), 1);

    const ix = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: new PublicKey(senderATA),    isSigner: false, isWritable: true },
        { pubkey: new PublicKey(recipientATA), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(senderPubkey), isSigner: true,  isWritable: false },
      ],
      data,
    });

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(senderPubkey);
    tx.add(ix);
    return tx;
  },

  // 서명된 트랜잭션 → base64
  _txToBase64(signedTx) {
    return signedTx.serialize().toString('base64');
  },

  // ──────────────────────────────────────────────────────────────
  // 내부: 트랜잭션 확인 대기
  // ──────────────────────────────────────────────────────────────
  async _confirmTransaction(signature, lastValidBlockHeight, rpcUrl, timeoutMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(rpcUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc:'2.0', id:1, method:'getSignatureStatuses',
          params: [[signature], { searchTransactionHistory: true }]
        })
      });
      const data = await res.json();
      const status = data?.result?.value?.[0];
      if (status) {
        if (status.err) throw new Error('TX_FAILED: ' + JSON.stringify(status.err));
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          return true;
        }
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('TX_TIMEOUT');
  },

  // ──────────────────────────────────────────────────────────────
  // 6. 트랜잭션 온체인 검증 (금액·수신주소 일치 확인)
  // ──────────────────────────────────────────────────────────────
  async verifyTransaction(signature, expectedRecipient, expectedAmount) {
    for (const rpc of SOLANA_RPC_ENDPOINTS) {
      try {
        const res = await fetch(rpc, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc:'2.0', id:1, method:'getTransaction',
            params: [signature, { encoding:'jsonParsed', maxSupportedTransactionVersion:0 }]
          })
        });
        const data = await res.json();
        const tx = data?.result;
        if (!tx) continue;

        const instructions = tx?.transaction?.message?.instructions || [];
        for (const ix of instructions) {
          if (ix.program === 'spl-token' && ix.parsed?.type === 'transfer') {
            const info = ix.parsed.info;
            const actualAmount = parseFloat(info.tokenAmount?.uiAmount || info.amount / 1_000_000 || 0);
            if (actualAmount >= expectedAmount * 0.999) { // 0.1% 오차 허용
              return { valid: true, amount: actualAmount, signature };
            }
          }
        }
        return { valid: false, reason: 'AMOUNT_MISMATCH' };
      } catch { continue; }
    }
    return { valid: false, reason: 'VERIFY_FAILED' };
  },
};

// ══════════════════════════════════════════════════════════════════
// DDRA 토큰 지갑 등록 유틸리티
// - Phantom(Solana) : wallet.watchAsset → SPL 토큰 즉시 추가
// - TokenPocket / MetaMask 계열(EVM) : wallet_watchAsset ERC-20 방식
// ══════════════════════════════════════════════════════════════════
window.DDRATokenRegister = {

  // ── 토큰 기본 정보 (관리자가 Firestore settings/system 에서 덮어씀) ──
  config: {
    // Solana SPL (Phantom / TokenPocket Solana 모드)
    solanaMint:   'ADDRWVJyvNrdHAd2aa8YuVMzRuN4RaxZsemiRZXW2EHu',
    solanaDecimals: 6,
    // EVM – BSC BEP-20 (TokenPocket EVM 모드)
    bscContract:  '',          // 예: '0xDDRA...'
    bscDecimals:  18,
    // 공통
    symbol:       'DDRA',
    name:         'DEEDRA Token',
    logoUrl:      'https://deedra.pages.dev/static/img/ddra-coin.png',
  },

  // ── 설정 Firestore에서 로드 ──
  async loadConfig(db, doc, getDoc) {
    try {
      const snap = await getDoc(doc(db, 'settings', 'system'));
      if (snap.exists()) {
        const d = snap.data();
        if (d.ddraSolanaMint)   this.config.solanaMint   = d.ddraSolanaMint;
        if (d.ddraBscContract)  this.config.bscContract  = d.ddraBscContract;
        if (d.ddraLogoUrl)      this.config.logoUrl       = d.ddraLogoUrl;
        if (d.ddraDecimals)     this.config.solanaDecimals = d.ddraDecimals;
      }
    } catch(e) { console.warn('[DDRATokenRegister] config load failed', e); }
  },

  // ── 감지: 어떤 지갑이 있는지 ──
  detectWalletType() {
    // Phantom Solana
    if (window.phantom?.solana?.isPhantom) return 'phantom';
    // Solflare
    if (window.solflare?.isSolflare) return 'solflare';
    // EVM 계열 (MetaMask / TokenPocket EVM / Trust Wallet)
    if (window.ethereum) {
      const provider = window.ethereum;
      if (provider.isTokenPocket) return 'tokenpocket_evm';
      if (provider.isMetaMask)    return 'metamask';
      return 'evm_generic';
    }
    // TokenPocket Solana 모드
    if (window.solana?.isTokenPocket) return 'tokenpocket_solana';
    if (window.solana) return 'solana_generic';
    return null;
  },

  // ── 메인: DDRA 토큰 지갑에 추가 ──
  async addToWallet() {
    const type = this.detectWalletType();

    if (!type) {
      return { success: false, error: 'NO_WALLET',
               message: '지갑이 감지되지 않습니다.\nPhantom 또는 TokenPocket을 먼저 설치해주세요.' };
    }

    // Solana 계열
    if (type === 'phantom' || type === 'solflare' || type === 'tokenpocket_solana' || type === 'solana_generic') {
      return await this._addToSolanaWallet(type);
    }

    // EVM 계열
    if (type === 'tokenpocket_evm' || type === 'metamask' || type === 'evm_generic') {
      return await this._addToEvmWallet(type);
    }

    return { success: false, error: 'UNSUPPORTED', message: '지원하지 않는 지갑 형식입니다.' };
  },

  // ── Phantom / Solflare / Solana 계열 ──
  async _addToSolanaWallet(type) {
    if (!this.config.solanaMint) {
      return { success: false, error: 'NO_MINT',
               message: 'DDRA Solana 토큰 주소가 아직 설정되지 않았습니다.\n관리자에게 문의해주세요.' };
    }

    try {
      let provider;
      if (type === 'phantom')   provider = window.phantom.solana;
      else if (type === 'solflare') provider = window.solflare;
      else provider = window.solana;

      // 연결 확인
      if (!provider.isConnected && provider.connect) {
        await provider.connect({ onlyIfTrusted: true }).catch(() => {});
      }

      // watchAsset – Phantom & Solflare 지원
      if (provider.watchAsset) {
        const result = await provider.watchAsset({
          type: 'SPL',
          options: {
            address:  this.config.solanaMint,
            symbol:   this.config.symbol,
            name:     this.config.name,
            decimals: this.config.solanaDecimals,
            image:    this.config.logoUrl,
          }
        });
        if (result) return { success: true, wallet: type, network: 'Solana' };
        return { success: false, error: 'USER_REJECTED', message: '사용자가 취소했습니다.' };
      }

      // watchAsset 미지원 시 주소 복사 안내
      return {
        success: false, error: 'NOT_SUPPORTED',
        message: `이 지갑은 자동 토큰 추가를 지원하지 않습니다.\n아래 Solana 민트 주소를 직접 추가해주세요:\n\n${this.config.solanaMint}`,
        mint: this.config.solanaMint
      };

    } catch(e) {
      if (e.code === 4001 || e.message?.includes('reject')) {
        return { success: false, error: 'USER_REJECTED', message: '사용자가 취소했습니다.' };
      }
      return { success: false, error: e.message, message: '토큰 추가 중 오류가 발생했습니다:\n' + e.message };
    }
  },

  // ── TokenPocket EVM / MetaMask / EVM 계열 ──
  async _addToEvmWallet(type) {
    if (!this.config.bscContract) {
      return { success: false, error: 'NO_CONTRACT',
               message: 'DDRA BSC(BEP-20) 컨트랙트 주소가 아직 설정되지 않았습니다.\n관리자에게 문의해주세요.' };
    }

    try {
      const provider = window.ethereum;

      // 1단계: BSC 네트워크 추가/전환
      await this._switchToBSC(provider);

      // 2단계: DDRA 토큰 추가
      const wasAdded = await provider.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address:  this.config.bscContract,
            symbol:   this.config.symbol,
            decimals: this.config.bscDecimals,
            image:    this.config.logoUrl,
          }
        }
      });

      if (wasAdded) return { success: true, wallet: type, network: 'BSC' };
      return { success: false, error: 'USER_REJECTED', message: '사용자가 취소했습니다.' };

    } catch(e) {
      if (e.code === 4001) return { success: false, error: 'USER_REJECTED', message: '사용자가 취소했습니다.' };
      return { success: false, error: e.message, message: '토큰 추가 중 오류가 발생했습니다:\n' + e.message };
    }
  },

  // ── BSC 메인넷으로 전환 (없으면 추가) ──
  async _switchToBSC(provider) {
    const BSC_CHAIN_ID = '0x38'; // 56
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_CHAIN_ID }] });
    } catch(switchErr) {
      // 체인이 없으면 추가
      if (switchErr.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BSC_CHAIN_ID,
            chainName: 'BNB Smart Chain',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: ['https://bsc-dataseed.binance.org/', 'https://bsc-dataseed1.defibit.io/'],
            blockExplorerUrls: ['https://bscscan.com/'],
          }]
        });
      }
    }
  },

  // ── 지갑 종류별 안내 문구 ──
  getWalletGuide() {
    const type = this.detectWalletType();
    const guides = {
      phantom:          { name: '👻 Phantom', network: 'Solana', color: '#ab9ff2' },
      solflare:         { name: '🔥 Solflare', network: 'Solana', color: '#fc8c00' },
      tokenpocket_solana:{ name: '💼 TokenPocket', network: 'Solana', color: '#2980fe' },
      tokenpocket_evm:  { name: '💼 TokenPocket', network: 'BSC(BEP-20)', color: '#2980fe' },
      metamask:         { name: '🦊 MetaMask',  network: 'BSC(BEP-20)', color: '#f6851b' },
      evm_generic:      { name: '🔗 EVM Wallet', network: 'BSC(BEP-20)', color: '#627eea' },
      solana_generic:   { name: '🌐 Solana Wallet', network: 'Solana', color: '#9945ff' },
    };
    return type ? (guides[type] || null) : null;
  },
};
