const { expect, assert } = require("chai");
const { BigNumber, utils } = require("ethers");
const fs = require("fs");
const { ethers, ethereum, web3, upgrades } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const {
  solidityPack,
  concat,
  toUtf8Bytes,
  keccak256,
  SigningKey,
  formatBytes32String,
} = utils;

describe("CoreskyAirDrop-test", function () {
  let accounts;
  let airdrops;
  let nft721;
  let leaves;
  let tree;
  // 5.创建ERC20合约
  let erc20TransferProxy;
  let erc20token;
  

  before(async function () {
    accounts = await ethers.getSigners();
    console.log("account0       depolyer:", accounts[0].address);
    console.log("account1          miner1:", accounts[1].address);
    console.log("account2          miner2:", accounts[2].address);
    console.log("account3          miner3:", accounts[3].address);
    console.log("account4          miner4:", accounts[4].address);
  });

  it("deploy", async function () {

    let admin = accounts[0].address;

    let user1 = accounts[1].address;

    let user2 = accounts[2].address;

    let user3 = accounts[3].address;

    let operator = accounts[4].address;
    // _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    // _setupRole(MINTER_ROLE, _msgSender());
    const TestMockAirDrop = await ethers.getContractFactory("CoreskyAirDropUpgradeable");

    // airdrops = await TestMockAirDrop.deploy(admin, operator);
    
    airdrops = await upgrades.deployProxy(TestMockAirDrop,[admin, operator]);
    await airdrops.deployed();

    console.log("TestMockAirDrop deployed to:", airdrops.address);

    let adminRole = await airdrops.DEFAULT_ADMIN_ROLE();
    
    let operatorRole = await airdrops.OPERATOR_ROLE();
    console.log("TestMockAirDrop DEFAULT_ADMIN_ROLE:", adminRole);
    console.log("TestMockAirDrop OPERATOR_ROLE:", operatorRole);

    // 为账户4增加burner权限
    await airdrops.grantRole(operatorRole, operator);

    console.log(
      "TestMockAirDrop grantRole[OPERATOR_ROLE] after:",
      operatorRole,
      await airdrops.hasRole(operatorRole, operator)
    );


    const TetherToken = await ethers.getContractFactory("TetherToken");

    // // TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals)
    erc20token = await TetherToken.deploy(
      "10000000000000000",
      "USD",
      "USDT",
      6
    );

    // const TetherToken = await ethers.getContractFactory("TestERC20");

    // TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals)
    // erc20token = await TetherToken.deploy();
    await erc20token.deployed();

    let totalSupply = await erc20token.totalSupply();

    console.log("USDT:", erc20token.address, "totalSupply:", totalSupply);
    console.log(
      "admin Balance:",
      admin,
      await erc20token.balanceOf(admin)
    );
    // 为账号0x51A41BA1Ce3A6Ac0135aE48D6B92BEd32E075fF0 转移10000
    await erc20token.transfer(operator, 100000000);
    console.log("operator Balance:", operator, await erc20token.balanceOf(operator));

  });

  it("sendNativeToken", async function () {

    let admin    = accounts[0];
    let user1    = accounts[1];
    let user2    = accounts[2];
    let user3    = accounts[3];
    let operator = accounts[4];

    console.log("admin    balance:",  (await admin.getBalance()).toString());
    console.log("user1    balance:",  (await user1.getBalance()).toString());
    console.log("user2    balance:",  (await user2.getBalance()).toString());
    console.log("user3    balance:",  (await user3.getBalance()).toString());
    console.log("operator balance:",  (await operator.getBalance()).toString());

    let users = [user1.address,user2.address,user3.address];
    let value = ['10000000000000000','10000000000000000','10000000000000000'];

    await airdrops.connect(operator).sendNativeToken(users, value, {
      from: operator.address,
      value: "100000000000000000",
    });

    console.log("admin airdrops    balance:", (await admin.getBalance()).toString());
    console.log("user1 airdrops    balance:", (await user1.getBalance()).toString());
    console.log("user2 airdrops    balance:", (await user2.getBalance()).toString());
    console.log("user3 airdrops    balance:", (await user3.getBalance()).toString());
    console.log("operator airdrops balance:", (await operator.getBalance()).toString());
    
  });

  it("sendERC20", async function () {
    let admin    = accounts[0];
    let user1    = accounts[1];
    let user2    = accounts[2];
    let user3    = accounts[3];
    let operator = accounts[4];


    console.log("admin    balanceOf:",(await erc20token.balanceOf(admin.address)));
    console.log("user1    balanceOf", (await erc20token.balanceOf(user1.address)));
    console.log("user2    balanceOf", (await erc20token.balanceOf(user2.address)));
    console.log("user3    balanceOf", (await erc20token.balanceOf(user3.address)));
    console.log("operator balanceOf", (await erc20token.balanceOf(operator.address)));

    // get allowance
    let allowaceBefore = await erc20token.allowance(operator.address, airdrops.address);
    // approve
    await erc20token.connect(operator).approve(airdrops.address, 100000);

    // get allowance
    let allowaceAfter = await erc20token.allowance(operator.address, airdrops.address);
    console.log(
      "allowace:",
      allowaceBefore,
      allowaceAfter
    );
    /**
     * function sendERC20(
        uint256 _batchNo,
        address _tokenAddress,
        address[] calldata _to,
        uint256[] calldata _value,
        uint256[] calldata _serialNo
    ) 
     */
    let _batchNo = 1;
    let _tokenAddress = erc20token.address;
    let _to = [
      user1.address,
      user2.address,
      user3.address,
    ];
    let _value = [
      1000,
      3000,
      5000
    ];
    let _serialNo = [
      1,
      2,
      3
    ];

    let tx =  await airdrops.connect(operator).sendERC20(_batchNo, _tokenAddress, _to, _value, _serialNo);
    console.log("admin    sendERC20 balanceOf:",(await erc20token.balanceOf(admin.address)));
    console.log("user1    sendERC20 balanceOf", (await erc20token.balanceOf(user1.address)));
    console.log("user2    sendERC20 balanceOf", (await erc20token.balanceOf(user2.address)));
    console.log("user3    sendERC20 balanceOf", (await erc20token.balanceOf(user3.address)));
    console.log("operator sendERC20 balanceOf", (await erc20token.balanceOf(operator.address)));


    console.log("transaction: ",tx.hash);
    let ret = await tx.wait();
    // console.log("tx.wait: ",ret.events);

    // getApNFTDrop
    console.log("CoreskyAirDrop getApNFTDrop:", (await airdrops.getApNFTDrop(_serialNo[0])));

    // getBatchSerialNo
    console.log("CoreskyAirDrop getBatchSerialNo:", (await airdrops.getBatchSerialNo(_batchNo)));

  });


  
  it("sendERC20_ETH", async function () {
    let admin    = accounts[0];
    let user1    = accounts[1];
    let user2    = accounts[2];
    let user3    = accounts[3];
    let operator = accounts[4];


    console.log("admin    balance:",  (await admin.getBalance()).toString());
    console.log("user1    balance:",  (await user1.getBalance()).toString());
    console.log("user2    balance:",  (await user2.getBalance()).toString());
    console.log("user3    balance:",  (await user3.getBalance()).toString());
    console.log("operator balance:",  (await operator.getBalance()).toString());

    /**
     * function sendERC20(
        uint256 _batchNo,
        address _tokenAddress,
        address[] calldata _to,
        uint256[] calldata _value,
        uint256[] calldata _serialNo
    ) 
     */
    let _batchNo = 2;
    let _tokenAddress = "0x0000000000000000000000000000000000000000";
    let _to = [
      user1.address,
      user2.address,
      user3.address,
    ];
    let _value = [
      1000,
      3000,
      5000
    ];
    let _serialNo = [
      11,
      21,
      31
    ];

    let tx =  await airdrops.connect(operator).sendERC20(_batchNo, 
      _tokenAddress, 
      _to, 
      _value,
      _serialNo,
      {
        from: operator.address,
        value: "100000000000000000",
      });
    console.log("admin airdrops    balance:", (await admin.getBalance()).toString());
    console.log("user1 airdrops    balance:", (await user1.getBalance()).toString());
    console.log("user2 airdrops    balance:", (await user2.getBalance()).toString());
    console.log("user3 airdrops    balance:", (await user3.getBalance()).toString());
    console.log("operator airdrops balance:", (await operator.getBalance()).toString());

    console.log("transaction: ",tx.hash);
    let ret = await tx.wait();
    // console.log("tx.wait: ",ret.events);

    // getApNFTDrop
    console.log("CoreskyAirDrop getApNFTDrop:", (await airdrops.getApNFTDrop(_serialNo[0])));

    // getBatchSerialNo
    console.log("CoreskyAirDrop getBatchSerialNo:", (await airdrops.getBatchSerialNo(_batchNo)));

  });


  function getAbi(jsonPath) {
    let file = fs.readFileSync(jsonPath);
    let abi = JSON.parse(file.toString()).abi;
    return abi;
  }

  function m(num) {
    return BigNumber.from("1000000000000000000").mul(num);
  }

  function d(bn) {
    return bn.div("1000000000000000").toNumber() / 1000;
  }

  function b(num) {
    return BigNumber.from(num);
  }

  function n(bn) {
    return bn.toNumber();
  }

  function s(bn) {
    return bn.toString();
  }
});
