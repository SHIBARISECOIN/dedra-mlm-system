import { Wallet, Contract, JsonRpcProvider, formatUnits, parseUnits } from 'ethers';
import TronWeb from 'tronweb';

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const USDT_BEP20 = '0x55d398326f99059fF775485246999027B3197955';
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT TRC20

export async function sweepBscUsdt(userPrivateKey: string, companyAddress: string, sponsorPrivateKey: string) {
  try {
    const provider = new JsonRpcProvider(BSC_RPC);
    const userWallet = new Wallet(userPrivateKey, provider);
    const sponsorWallet = new Wallet(sponsorPrivateKey, provider);
    const usdtContract = new Contract(USDT_BEP20, ERC20_ABI, userWallet);

    const usdtBalance = await usdtContract.balanceOf(userWallet.address);
    if (usdtBalance <= 0n) return { success: false, reason: 'No USDT balance' };

    // 가스비 대납 (0.0003 BNB -> 0.0005 BNB buffer)
    const requiredGasBnb = parseUnits('0.0005', 'ether');
    const userBnbBalance = await provider.getBalance(userWallet.address);

    if (userBnbBalance < requiredGasBnb) {
      const fundTx = await sponsorWallet.sendTransaction({
        to: userWallet.address,
        value: requiredGasBnb - userBnbBalance
      });
      await fundTx.wait(); 
    }

    const sweepTx = await usdtContract.transfer(companyAddress, usdtBalance);
    await sweepTx.wait();

    return { 
      success: true, 
      txid: sweepTx.hash, 
      amount: parseFloat(formatUnits(usdtBalance, 18)),
      network: 'BSC'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sweepTronUsdt(userPrivateKey: string, companyAddress: string, sponsorPrivateKey: string) {
  try {
    // Cloudflare Worker에서 TronWeb은 fetch proxy 등 환경 제약이 있을 수 있지만 시도해봄
    const tronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: sponsorPrivateKey
    });
    
    const userTronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: userPrivateKey
    });

    const userAddress = userTronWeb.defaultAddress.base58;
    const usdtContract = await userTronWeb.contract().at(TRON_USDT);
    const usdtBalance = await usdtContract.balanceOf(userAddress).call();
    
    const balNum = Number(usdtBalance);
    if (balNum <= 0) return { success: false, reason: 'No USDT balance' };

    // TRX 가스비 대납 (약 15 TRX 또는 30 TRX -> 안전하게 30 TRX)
    const requiredTrx = 30 * 1e6; // sun
    const userTrxBalance = await userTronWeb.trx.getBalance(userAddress);

    if (userTrxBalance < requiredTrx) {
        // 스폰서에서 유저에게 전송
        const fundTx = await tronWeb.trx.sendTransaction(userAddress, requiredTrx - userTrxBalance);
        // 트론은 즉각 wait() 함수가 없어 5초정도 대기하는 폴링 구현
        await new Promise(r => setTimeout(r, 5000));
    }

    // 유저가 본사로 전송
    const sweepTx = await usdtContract.transfer(companyAddress, balNum).send();

    return { 
      success: true, 
      txid: sweepTx, // send() 반환값이 txid
      amount: balNum / 1e6, // TRC20 USDT는 6자리
      network: 'TRON'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}


export async function sweepBscNative(userPrivateKey: string, companyAddress: string) {
  try {
    const provider = new JsonRpcProvider(BSC_RPC);
    const userWallet = new Wallet(userPrivateKey, provider);
    
    const balance = await provider.getBalance(userWallet.address);
    if (balance <= 0n) return { success: false, reason: 'No BNB balance' };

    // Estimate gas for a simple transfer
    const gasPrice = (await provider.getFeeData()).gasPrice || parseUnits('3', 'gwei');
    const gasLimit = 21000n;
    const fee = gasPrice * gasLimit;

    if (balance <= fee) return { success: false, reason: 'Balance too low to cover gas' };

    const amountToSend = balance - fee;
    const amountInBnb = parseFloat(formatUnits(amountToSend, 18));
    
    // Only sweep if it's worth more than a tiny fraction, e.g. 0.005 BNB (~$3)
    if (amountInBnb < 0.005) return { success: false, reason: 'BNB amount too small to sweep' };

    // Get current BNB price from Binance
    const priceRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
    const priceData = await priceRes.json();
    const bnbPrice = parseFloat(priceData.price);
    const usdtValue = amountInBnb * bnbPrice;

    const tx = await userWallet.sendTransaction({
      to: companyAddress,
      value: amountToSend,
      gasLimit,
      gasPrice
    });

    await tx.wait();

    return { 
      success: true, 
      txid: tx.hash, 
      amount: amountInBnb,
      usdtValue: usdtValue,
      network: 'BSC',
      currency: 'BNB'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sweepTronNative(userPrivateKey: string, companyAddress: string) {
  try {
    const userTronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: userPrivateKey
    });

    const userAddress = userTronWeb.defaultAddress.base58;
    const balanceSun = await userTronWeb.trx.getBalance(userAddress);
    
    // TRON native transfer fee is usually 0.1 ~ 1.1 TRX if account is active
    // Let's reserve 1.5 TRX to be safe
    const feeSun = 1.5 * 1e6; 
    
    if (balanceSun <= feeSun) return { success: false, reason: 'Balance too low to cover gas' };

    const amountToSendSun = balanceSun - feeSun;
    const amountInTrx = amountToSendSun / 1e6;

    // Only sweep if TRX is > 20 (~$2.4)
    if (amountInTrx < 20) return { success: false, reason: 'TRX amount too small to sweep' };

    // Get current TRX price
    const priceRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=TRXUSDT');
    const priceData = await priceRes.json();
    const trxPrice = parseFloat(priceData.price);
    const usdtValue = amountInTrx * trxPrice;

    const tx = await userTronWeb.trx.sendTransaction(companyAddress, amountToSendSun);
    let txidStr = tx;
    if (tx && tx.transaction && tx.transaction.txID) txidStr = tx.transaction.txID;
    else if (tx && tx.txid) txidStr = tx.txid;

    return { 
      success: true, 
      txid: txidStr,
      amount: amountInTrx,
      usdtValue: usdtValue,
      network: 'TRON',
      currency: 'TRX'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function transferBscUsdt(userPrivateKey: string, companyAddress: string, sponsorPrivateKey: string, amount: number) {
  try {
    const provider = new JsonRpcProvider(BSC_RPC);
    const userWallet = new Wallet(userPrivateKey, provider);
    const sponsorWallet = new Wallet(sponsorPrivateKey, provider);
    const usdtContract = new Contract(USDT_BEP20, ERC20_ABI, userWallet);

    const amountWei = parseUnits(amount.toString(), 18);
    const usdtBalance = await usdtContract.balanceOf(userWallet.address);
    if (usdtBalance < amountWei) return { success: false, reason: 'Insufficient USDT balance' };

    // 가스비 대납 (0.0003 BNB -> 0.0005 BNB buffer)
    const requiredGasBnb = parseUnits('0.0005', 'ether');
    const userBnbBalance = await provider.getBalance(userWallet.address);

    if (userBnbBalance < requiredGasBnb) {
      const fundTx = await sponsorWallet.sendTransaction({
        to: userWallet.address,
        value: requiredGasBnb - userBnbBalance
      });
      await fundTx.wait(); 
    }

    const sweepTx = await usdtContract.transfer(companyAddress, amountWei);
    await sweepTx.wait();

    return { 
      success: true, 
      txid: sweepTx.hash, 
      amount: amount,
      network: 'BSC'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function transferTronUsdt(userPrivateKey: string, companyAddress: string, sponsorPrivateKey: string, amount: number) {
  try {
    const tronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: sponsorPrivateKey
    });
    
    const userTronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: userPrivateKey
    });

    const userAddress = userTronWeb.defaultAddress.base58;
    const usdtContract = await userTronWeb.contract().at(TRON_USDT);
    
    const amountSun = amount * 1e6; // USDT TRC20 is 6 decimals
    const usdtBalanceStr = await usdtContract.balanceOf(userAddress).call();
    const usdtBalance = Number(usdtBalanceStr);
    
    if (usdtBalance < amountSun) return { success: false, reason: 'Insufficient USDT balance' };

    // TRX 가스비 대납 (약 15 TRX 또는 30 TRX -> 안전하게 30 TRX)
    const requiredTrx = 30 * 1e6; // sun
    const userTrxBalance = await userTronWeb.trx.getBalance(userAddress);

    if (userTrxBalance < requiredTrx) {
        // 스폰서에서 유저에게 전송
        const fundTx = await tronWeb.trx.sendTransaction(userAddress, requiredTrx - userTrxBalance);
        await new Promise(r => setTimeout(r, 5000));
    }

    // 유저가 본사로 전송
    const sweepTx = await usdtContract.transfer(companyAddress, amountSun).send();

    return { 
      success: true, 
      txid: sweepTx, 
      amount: amount,
      network: 'TRON'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
