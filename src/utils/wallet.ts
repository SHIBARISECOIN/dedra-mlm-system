import { Keypair, Connection, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * 🚀 Deedra Wallet Core Engine (Solana Web3)
 */

// 1. 새로운 디드라 지갑 생성
export function createDeedraWallet() {
    const keypair = Keypair.generate();
    return {
        publicKey: keypair.publicKey.toBase58(), // 입금용 공개 주소
        secretKey: bs58.encode(keypair.secretKey) // 마스터 열쇠(출금용) - 절대 노출 금지
    };
}

// 2. 솔라나 메인넷 통신 엔진 (잔액 확인 및 전송을 위한 파이프라인)
export const getSolanaConnection = () => {
    // 대표님께서 나중에 자체 RPC(고속 통신망)를 구매하시면 이 주소만 교체하면 됩니다.
    return new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
};
