/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");

require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
// require("hardhat-docgen");
require("xdeployer");

require("dotenv").config();

const { ProxyAgent, setGlobalDispatcher } = require("undici");
const proxyAgent = new ProxyAgent("http://127.0.0.1:15236");
setGlobalDispatcher(proxyAgent);
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const {
  INFURA_API_KEY,
  GOERLI_PRIVATE_KEY1,
  GOERLI_PRIVATE_KEY2,
  ETHERSCAN_API_KEY,
  ETH_PK_2,
  ETH_PK_3,
  ETH_PK_4,
  POLYGON_MUMBAISCAN_API_KEY,
  ALCHEMY_API_KEY
} = process.env;

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      gas: 30000000,
    },
    localhost: {
      allowUnlimitedContractSize: true,
      gas: 30000000,
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [
        GOERLI_PRIVATE_KEY1,
        GOERLI_PRIVATE_KEY2,
        ETH_PK_2,
        ETH_PK_3,
        ETH_PK_4,
      ],
    },
    polygon_main: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [
        GOERLI_PRIVATE_KEY1,
        GOERLI_PRIVATE_KEY2,
        ETH_PK_2,
        ETH_PK_3,
        ETH_PK_4,
      ],
      chainId: 137,
      gas: 3000000,
    },
    iotex_main: {
      url: `https://babel-api.mainnet.iotex.io/`,
      accounts: [
        GOERLI_PRIVATE_KEY1,
        GOERLI_PRIVATE_KEY2,
        ETH_PK_2,
        ETH_PK_3,
        ETH_PK_4,
      ],
      symbol: 'IOTX',
      explorer: 'https://iotexscan.io',
      chainId: 4689,
      gas: 8500000,
      gasPrice: 1000000000000
    },
    iotex_test: {
      url: `https://babel-api.testnet.iotex.io/`,
      accounts: [
        GOERLI_PRIVATE_KEY1,
        GOERLI_PRIVATE_KEY2,
        ETH_PK_2,
        ETH_PK_3,
        ETH_PK_4,
      ],
      symbol: 'IOTX',
      explorer: 'https://testnet.iotexscan.io',
      chainId: 4690,
      gas: 8500000,
      gasPrice: 1000000000000
    },
  },
  etherscan: {
    apiKey: {
      polygon: POLYGON_MUMBAISCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      iotex_test: 'iotex_test',// It's here just for hardhat arguments validation
      //It  can be set as arbitrary value
      iotex_mainnet: 'iotex_mainnet'// It's here just for hardhat arguments validation
      //It  can be set as arbitrary value
    },
    customChains: [
      {
        // https://docs.iotex.io/builders/launch-dapps-on-iotex/verify-smart-contracts
        network: "iotex_mainnet",
        chainId: 4689,
        urls: {
          apiURL: "https://iotexscout.io/api",
          browserURL: "https://iotexscan.io"
        }
      },
      {
        
        // https://docs.iotex.io/builders/launch-dapps-on-iotex/verify-smart-contracts
        network: "iotex_test",
        chainId: 4690,
        urls: {
          apiURL: "https://testnet.iotexscout.io/api",
          browserURL: "https://testnet.iotexscan.io"
        }
      }
    ]
  },
  docgen: {
    path: "./documents",
    clear: true,
    runOnCompile: true,
  },
  solidity: {
    compilers: [
      {
        version: "0.4.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.4.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.19",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    ]
  },
};
