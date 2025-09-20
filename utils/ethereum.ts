import { Alchemy, Network } from "alchemy-sdk";
import { ethers } from "ethers";
import { Deposit } from "../types/eth";

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};

//setting up alchemy
const alchemy = new Alchemy(settings);
const beaconDepositContract = "0x0a502f846F6dc2e3D4d8C595B18b3AF44657B1bD";

export async function getLatestBlockNumber(): Promise<number> {
  return await alchemy.core.getBlockNumber();
}

// ABI of the deposit function in the Beacon Deposit Contract
const ABI = [
  "function deposit(bytes48 pubkey, bytes32 withdrawal_credentials, uint64 amount, bytes96 signature, bytes32 index)",
];
const iface = new ethers.utils.Interface(ABI);

//function to get the transactions
export async function getDeposits(
  fromBlock: number,
  toBlock: number,
): Promise<Deposit[]> {
  const deposits: Deposit[] = [];
  const events = await alchemy.core.getLogs({
    fromBlock,
    toBlock,
    address: beaconDepositContract,
  });

  for (const event of events) {
    const tx = await alchemy.core.getTransaction(event.transactionHash);
    const receipt = await alchemy.core.getTransactionReceipt(
      event.transactionHash,
    );
    const block = await alchemy.core.getBlock(event.blockNumber);
    console.log(tx);
    //checking if the transaction, block and receipt are not null
    if (tx && block && receipt) {
      const inputData = tx.data;
      const depositsInTransaction = decodeDepositData(inputData);
      for (const depositData of depositsInTransaction) {
        const deposit: Deposit = {
          blockNumber: event.blockNumber,
          blockTimestamp: block.timestamp,
          fee: tx.gasPrice?.mul(tx.gasLimit) || ethers.BigNumber.from(0),
          hash: event.transactionHash,
          pubkey: "0x" + event.data.slice(2, 98),
          amount: depositData.amount,
          senderAddress: tx.from,
          gasUsed: receipt.gasUsed,
        };
        deposits.push(deposit);
      }
    }
  }
  console.log("Deposits:", deposits);
  return deposits;
}

function decodeDepositData(inputData: string): { amount: ethers.BigNumber }[] {
  try {
    const decodedData = iface.decodeFunctionData("deposit", inputData);
    const amount = ethers.BigNumber.from(decodedData[4]);
    return [{ amount }];
  } catch (error) {
    console.error("Error decoding deposit data:", error);
    return [{ amount: ethers.BigNumber.from(0) }];
  }
}
