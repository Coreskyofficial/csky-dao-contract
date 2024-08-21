const { network, ethers, upgrades } = require('hardhat');

const { getJson, updateJson } = require('./json.js')

function deployedFilePath() {
  return `${ network.name }.deployed.json`
}

function getDeployed() {
  try {
    return getJson(deployedFilePath());
  } catch {
    updateDeployed({});
    return {};
  }
}

function updateDeployed(jsonData) {
  updateJson(jsonData, deployedFilePath());
}

async function deploy(signer, contract, ...arg ) {
    return await _deploy(signer, contract, {}, ...arg);
}

async function _deploy(signer, contract, overrides, ...arg ) {
    
    // 已经部署存在则不在重新部署
    const deployed = getDeployed();
    if( deployed[contract] !== undefined && network.name != 'hardhat' ) {
        console.log(`${contract} deployed already on : `, deployed[contract]);
        return await getDeployedInstance(signer, contract);
    }
    // init
    const Contract = await ethers.getContractFactory(contract, { signer });
    
    // 估算 gas
    const { signerBalance, estimatedPrice } = await _gasCalculate(signer, await signer.estimateGas(Contract.getDeployTransaction(...arg)));
    if( signerBalance < estimatedPrice ) throw new Error('Insufficient balance')

    // deploy
    const instance = await Contract.deploy(...arg, overrides);
    
    // show verify and tx 
    if(network.name != 'hardhat' && network.name != 'localhost') {
        // get nonce and hash
        const hash = instance.deployTransaction['hash'];
        const nonce = instance.deployTransaction['nonce'];
        console.log(`nonce : ${nonce} ,  hash : ${hash} `);
        console.log(`npx hardhat verify --network ${network.name} ${instance.address} ${arg.join(" ")}`);
    }
    
    // 等待 deployed
    await instance.deployTransaction.wait();

    // show contract address
    console.log(`${contract} deployed on ${instance.address} \n`);
    
    // 记录到文件
    if(network.name != 'hardhat'){
      deployed[contract] = instance.address;
      updateDeployed(deployed);
    }

    // return contract
    // instance.deployTransaction)
    return instance;
}

async function gasCalculate(signer, contract, ...arg) {
    const Contract = await ethers.getContractFactory(contract, { signer });
    return await _gasCalculate(signer, await signer.estimateGas(Contract.getDeployTransaction(...arg)));
}



async function _gasCalculate(signer, estimatedGas) {
    const gasPrice = await signer.getGasPrice();
    const deploymentPrice = gasPrice.mul(estimatedGas);
    const deployerBalance = await signer.getBalance();
    
    return {
        "signerGasPrice": gasPrice,
        "signerBalance" : ethers.utils.formatEther(deployerBalance),
        "estimatedGas" : estimatedGas,
        "estimatedPrice" : ethers.utils.formatEther(deploymentPrice)
    };
}

// cancel
async function cancel(signer, nonceOfPendingTx, gasPriceHigherThanPendingTx) {
    const tx = {
        nonce: nonceOfPendingTx,
        to: ethers.constants.AddressZero,
        data: '0x',
        gasPrice: gasPriceHigherThanPendingTx
      }; // costs 21000 gas
      
      await signer.sendTransaction(tx);
}


// https://stats.goerli.net/
// https://goerli.etherscan.io/txs
//
// overrides = {
//    gasPrice: 75490945963, // (75.49 Gwei)
//    nonce: 24
// };
async function speedUp(signer, contract, overrides, ...arg) {
    return await _deploy(signer, contract, overrides, ...arg);
}

async function getDeployedInstance(signer, contract) {
  const deployed = getDeployed();
  if(deployed[contract] === undefined) throw new Error('None Deployed');
  const Contract = await ethers.getContractFactory(contract, { signer });
  return Contract.attach(deployed[contract]);
}

async function getAttach(signer, contract, deployedAddress) {
  if(deployedAddress === undefined) throw new Error('None Deployed');
  const Contract = await ethers.getContractFactory(contract, { signer });
  return Contract.attach(deployedAddress);
}

module.exports = {
  getAttach,
    getDeployed,
    getDeployedInstance,
    gasCalculate,
    deploy,
    cancel,
    speedUp
}
  