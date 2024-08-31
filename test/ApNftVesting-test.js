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

describe("ApNftVesting-test", function () {

  let _name = "CS-NFT721";
  let _symbol = "ApNFT";
  let _baseUri = "ipfs:/";


  let accounts;
  let apNftVesting;
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
    let minter = accounts[1];
    let receivedAddress = accounts[2].address;
    let user = accounts[3].address;
    let operator = accounts[4].address;
    // _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    // _setupRole(MINTER_ROLE, _msgSender());
    const TestApNftVesting = await ethers.getContractFactory("ApNftVestingUpgradeable");

    /**
     * 
        address admin,
        address operator,
        address receivedAddress
     */

    // apNftVesting = await TestApNftVesting.deploy(admin, receivedAddress);
    apNftVesting = await upgrades.deployProxy(TestApNftVesting, [admin, receivedAddress])
    await apNftVesting.deployed();

    console.log("TestApNftVesting deployed to:", apNftVesting.address);

    let adminRole = await apNftVesting.DEFAULT_ADMIN_ROLE();
    let operatorRole = await apNftVesting.OPERATOR_ROLE();
    console.log("TestApNftVesting DEFAULT_ADMIN_ROLE:", adminRole);
    console.log("TestApNftVesting OPERATOR_ROLE:", operatorRole);

    // 为账户4增加burner权限
    await apNftVesting.grantRole(operatorRole, operator);

    console.log(
      "TestApNftVesting grantRole[OPERATOR_ROLE] after:",
      operatorRole,
      await apNftVesting.hasRole(operatorRole, operator)
    );


    // =====================================================================
    // _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    // _setupRole(MINTER_ROLE, _msgSender());
    // _setupRole(BURNER_ROLE, _msgSender());
    const TestMockNFT721 = await ethers.getContractFactory("AssetPackagedNFTUpgradeable");
    /**
		 * 
		constructor(
			string memory _name,
			string memory _symbol,
			string memory _baseUri
		)
		 */
    nft721 = await upgrades.deployProxy(TestMockNFT721,[_symbol, _name, _baseUri]);
    // nft721 = await TestMockNFT721.deploy(_name, _symbol, _baseUri);
    await nft721.deployed();

    console.log("TestMockNFT721 deployed to:", nft721.address);

    adminRole = await nft721.DEFAULT_ADMIN_ROLE();
    let minterRole = await nft721.MINTER_ROLE();
    console.log("TestMockNFT721 DEFAULT_ADMIN_ROLE:", adminRole);
    console.log("TestMockNFT721 MINTER_ROLE:", minterRole);

    console.log(
      "TestMockNFT721 grantRole[MINTER_ROLE] before:",
      minter.address,
      await nft721.hasRole(minterRole, minter.address)
    );
    // 为账户2增加minter权限
    await nft721.grantRole(minterRole, minter.address);

    console.log(
      "TestMockNFT721 grantRole[MINTER_ROLE] after:",
      minter.address,
      await nft721.hasRole(minterRole, minter.address)
    );

    // 为用户空投5张NFT 
    let users = [
      user,user,user,user,user
    ];
    await nft721.connect(minter).ownerBatchMint(users);
    console.log("ownerBatchMint done");
    console.log("user ",user, " balanceOf:", n(await nft721.balanceOf(user)));

    // const TetherToken = await ethers.getContractFactory("TetherToken");

    // // TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals)
    // erc20token = await TetherToken.deploy(
    //   "10000000000000000",
    //   "USD",
    //   "USDT",
    //   6
    // );

    // const TetherToken = await ethers.getContractFactory("TestERC20");

    // // TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals)
    // erc20token = await TetherToken.deploy();
    // await erc20token.deployed();

    // let totalSupply = await erc20token.totalSupply();

    // console.log("USDT:", erc20token.address, "totalSupply:", totalSupply);
    // console.log(
    //   "admin Balance:",
    //   admin,
    //   await erc20token.balanceOf(admin)
    // );
    // // 为账号0x51A41BA1Ce3A6Ac0135aE48D6B92BEd32E075fF0 转移10000
    // await erc20token.transfer(user, 100000000);
    // console.log("user Balance:", user, await erc20token.balanceOf(user));

  });

  it("apNftTransfer", async function () {
    let admin = accounts[0];
    let minter = accounts[1];
    let receivedAddress = accounts[2];
    let user = accounts[3];
    let operator = accounts[4];

    let _batchNo = 1;
    let _serialNo = 1;
    let _apNFTaddess = nft721.address;
    let _tokenID = 1;

    // 查询当前地址是否存在NFT
    console.log("receivedAddress ",receivedAddress.address, " balanceOf:", n(await nft721.balanceOf(receivedAddress.address)));
    console.log("From tokenId", _tokenID ," OwnerOf ", await nft721.ownerOf(_tokenID));
    // 判断用户合约是否有权限 isApprovedForAll(address owner, address operator)
    let _isApprovedForAll = await nft721.isApprovedForAll(user.address, apNftVesting.address);
    console.log("apNftVesting contract isApprovedForAll: ", _isApprovedForAll);
    if(!_isApprovedForAll){
      // 用户授权合约可以转移NFT
     await nft721.connect(user).setApprovalForAll(apNftVesting.address, true);
     _isApprovedForAll = await nft721.isApprovedForAll(user.address, apNftVesting.address);
     console.log("apNftVesting contract isApprovedForAll: ", _isApprovedForAll);
    }
    

    await 
    // 用户转移NFT到接受地址
    // function transfer(uint256 _batchNo, address _apNFTaddess, uint256 _tokenID,uint256 _serialNo) public whenNotPaused() onlyNFT(_apNFTaddess) 
    await apNftVesting.connect(user).transfer(_batchNo, _apNFTaddess, _tokenID,  _serialNo, {
      from: user.address,
      value: 0,
    });

    console.log("To ", _tokenID ," OwnerOf ", await nft721.ownerOf(_tokenID));

    // getReceivedAddress
    console.log("apNftVesting getReceivedAddress:", await apNftVesting.getReceivedAddress());

    // getTransferRecords
    console.log("apNftVesting getTransferRecords:", await apNftVesting.getTransferRecords(user.address, _apNFTaddess));

    // getApNftRecords
    console.log("apNftVesting getApNftRecords:", await apNftVesting.getApNftRecords(_apNFTaddess, _tokenID));

    // getApNFT
    console.log("apNftVesting getApNFT:", await apNftVesting.getApNFT(_serialNo));

    // getBatchSerialNo
    console.log("apNftVesting getBatchSerialNo:", await apNftVesting.getBatchSerialNo(_batchNo));

  });


  it("batchTransfer", async function () {
    let admin = accounts[0];
    let minter = accounts[1];
    let receivedAddress = accounts[2];
    let user = accounts[3];
    let operator = accounts[4];

    let _batchNo = 2;
    let _serialNos = [22,23,24,25];
    let _apNFTaddess = nft721.address;
    let _tokenIDs = [2,3,4,5];

    // 查询当前地址是否存在NFT
    console.log("receivedAddress ",receivedAddress.address, " balanceOf:", n(await nft721.balanceOf(receivedAddress.address)));
    console.log("From tokenId", _tokenIDs ," OwnerOf ", await nft721.ownerOf(_tokenIDs[0]));
    // 判断用户合约是否有权限 isApprovedForAll(address owner, address operator)
    let _isApprovedForAll = await nft721.isApprovedForAll(user.address, apNftVesting.address);
    console.log("apNftVesting contract isApprovedForAll: ", _isApprovedForAll);
    if(!_isApprovedForAll){
      // 用户授权合约可以转移NFT
     await nft721.connect(user).setApprovalForAll(apNftVesting.address, true);
     _isApprovedForAll = await nft721.isApprovedForAll(user.address, apNftVesting.address);
     console.log("apNftVesting contract isApprovedForAll: ", _isApprovedForAll);
    }

    
    // getReceivedAddress
    console.log("apNftVesting setReceivedAddress Before:", await apNftVesting.getReceivedAddress());
    // 设置归集钱包地址
    await apNftVesting.connect(admin).setReceivedAddress(operator.address);
    

    // 用户转移NFT到接受地址
    // function batchTransfer(uint256 _batchNo, address _apNFTaddess, uint256[] _tokenID,uint256[] _serialNo) public whenNotPaused() onlyNFT(_apNFTaddess) 
    let tx = await apNftVesting.connect(user).batchTransfer(_batchNo, _apNFTaddess, _tokenIDs,  _serialNos, {
      from: user.address,
      value: 0,
    });

    console.log("transaction: ",tx.hash);
    let ret = await tx.wait();
    console.log("tx.wait: ",ret.events);

    console.log("To ", _tokenIDs ," OwnerOf ", await nft721.ownerOf(_tokenIDs[0]));

    // getReceivedAddress
    console.log("apNftVesting setReceivedAddress After:", await apNftVesting.getReceivedAddress());

    // getTransferRecords
    console.log("apNftVesting getTransferRecords:", await apNftVesting.getTransferRecords(user.address, _apNFTaddess));

    // getApNftRecords
    console.log("apNftVesting getApNftRecords:", await apNftVesting.getApNftRecords(_apNFTaddess, _tokenIDs[0]));

    // getApNFT
    console.log("apNftVesting getApNFT:", await apNftVesting.getApNFT(_serialNos[0]));

    // getBatchSerialNo
    console.log("apNftVesting getBatchSerialNo:", await apNftVesting.getBatchSerialNo(_batchNo));

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
