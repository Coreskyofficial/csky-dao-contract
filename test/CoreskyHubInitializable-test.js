const chai = require("chai");
const { ethers, ethereum, web3, upgrades } = require("hardhat");
const { BigNumber, utils, provider } = ethers;
const { zeroAddress } = require("ethereumjs-util");
const { signTypedData, signProjectVote, signDeployApNFT, signDeposit } = require("./signCoreskyHub.js");
const { toUtf8Bytes, keccak256, splitSignature, defaultAbiCoder } = utils;
const {
  SIGN_PUB,
  SIGN_PRI
} = process.env;


const TRANSTER_EVENT = keccak256(toUtf8Bytes("Transfer(address,address,uint256)"));
const AIRDROP_TOKEN_EVENT = keccak256(toUtf8Bytes("AirDropToken(address,address,uint256,uint256,uint256,uint256)"));

const groupID = 1;
describe("CoreskyHubInitializable-test", function () {
  let lpid = 256;
  let presaleUsers = [];
  let accounts;
  let coreskyHub;
  let coreskyHubUpdadeV2;
  let launchpad;
  let nft721;
  let apNftNo;
  let erc20token;

  let issueToken;

  // string memory _name,
  // string memory _symbol,
  // string memory _baseUri

  let _name = "CS-NFT721";
  let _symbol = "CS";
  let _baseUri = "ipfs:/";

  before(async function () {
    accounts = await ethers.getSigners();
    console.log("account0       depolyer:", accounts[0].address);
    console.log("account1          miner1:", accounts[1].address);
    console.log("account2          miner2:", accounts[2].address);
    console.log("account3          miner3:", accounts[3].address);
    console.log("account4          miner4:", accounts[4].address);
  });

  it("deploy", async function () {
    const { admin, operator, bob } = await signer();

    let user = accounts[4].address;

    const TetherToken = await ethers.getContractFactory("TetherToken");

    // TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals)
    erc20token = await TetherToken.deploy("10000000000000000", "USD", "USDT", 6);
    await erc20token.deployed();
    let totalSupply = await erc20token.totalSupply();

    console.log("USDT:", erc20token.address, "totalSupply:", totalSupply);
    console.log("admin Balance:", admin.address, await erc20token.balances(admin.address));
    // 为账号0x51A41BA1Ce3A6Ac0135aE48D6B92BEd32E075fF0 转移10000
    await erc20token.transfer(user, 1000000);
    console.log("user Balance:", user, await erc20token.balances(user));

    const TestAllocation = await ethers.getContractFactory("AllocationUpgradeable");
    let allocationPlatform = await TestAllocation.deploy();
    await allocationPlatform.deployed();

    const TestApNft = await ethers.getContractFactory("AssetPackagedNFTUpgradeable");
    let apNftPlatform = await TestApNft.deploy();
    await apNftPlatform.deployed();

    const TestCoreskyHubInitializable = await ethers.getContractFactory("CoreskyHubInitializable");
    coreskyHub = await upgrades.deployProxy(TestCoreskyHubInitializable, [allocationPlatform.address, apNftPlatform.address, admin.address, operator.address, SIGN_PUB]);
    await coreskyHub.deployed();
    
    console.log("upgradeableContract deployed to:", coreskyHub.address, "version:", (await coreskyHub.getRevision()));
  });

  let airdrops;
  it("depoly-CoreskyAirDrop", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    // _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    // _setupRole(MINTER_ROLE, _msgSender());
    const TestMockAirDrop = await ethers.getContractFactory("CoreskyAirDropUpgradeable");

    // airdrops = await TestMockAirDrop.deploy(admin.address, operator.address);
    airdrops = await upgrades.deployProxy(TestMockAirDrop, [admin.address, operator.address]);
    
    await airdrops.deployed();

    console.log("TestMockAirDrop deployed to:", airdrops.address);
  });

  it("Coresky-setCoreskyAirDrop", async function () {
    const { admin, operator, bob, sam, user, signBot } = await signer();

    let adminRole = await airdrops.DEFAULT_ADMIN_ROLE();
    let operatorRole = await airdrops.OPERATOR_ROLE();
    console.log("TestMockAirDrop DEFAULT_ADMIN_ROLE:", adminRole);
    console.log("TestMockAirDrop OPERATOR_ROLE:", operatorRole);

    console.log(
      "TestMockAirDrop grantRole[OPERATOR_ROLE] before:",
      coreskyHub.address,
      await airdrops.hasRole(operatorRole, coreskyHub.address)
    );

    await coreskyHub.setCoreskyAirDrop(airdrops.address);

    // 项目授权
    await airdrops.grantRole(operatorRole, coreskyHub.address);

    
    // 机器人授权
    await airdrops.grantRole(operatorRole, signBot.address);

    console.log(
      "TestMockAirDrop grantRole[OPERATOR_ROLE] after:", 
      coreskyHub.address,
      await airdrops.hasRole(operatorRole, coreskyHub.address)
    );
  });

  it("IssueToken", async function () {
    const { admin, operator, bob } = await signer();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");

    // constructor() payable ERC20("ERC20Mock", "ERC20Mock")
    issueToken = await ERC20Mock.connect(bob).deploy();
    await issueToken.deployed();
    let totalSupply = await issueToken.totalSupply();

    console.log("ERC20Mock:", issueToken.address, "totalSupply:", totalSupply);
    console.log(
      "bob Balance:",
      bob.address,
      await issueToken.balanceOf(bob.address)
    );
    // 为账号0x51A41BA1Ce3A6Ac0135aE48D6B92BEd32E075fF0 转移10000
    // await issueToken.transfer(user, m(10000000));
    // console.log("user Balance:", user, await issueToken.balanceOf(user));


    // await issueToken.transfer(user2, m(10000000));
    // console.log("user2 Balance:", user2, await issueToken.balanceOf(user2));
    
  });

  it("calculateDomainSeparator", async function () {
    //
    console.log("calculateDomainSeparator:", await coreskyHub.getDomainSeparator());

    let tx = await coreskyHub.incrementNonce(0);

    let event = await tx.wait();

    console.log(event.events);
  });

  it("applyProjectVote-bob-【success】", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    let project = bob;

    let nonce = parseInt(await coreskyHub.connect(bob).nonce());
    let now = parseInt(new Date().getTime() / 1000);
    let deadline = now + 5 * 60;
    let serialNo = groupID;

    let supportCount = 50;
    let opposeCount = 10;
    let voteRatio = (supportCount * 10000) / (supportCount + opposeCount);
    voteRatio = parseInt(voteRatio);

    let expireTime = now + 10 * 60;
    /**
         * 
        struct ProjectVote{
            // 投票编号
            uint256 serialNo;
            // 项目方地址
            address projectAddr;
            // 支持数量
            uint256 supportCount;
            // 反对数量
            uint256 opposeCount;
            // 投票比率
            uint256 voteRatio;
            // 过期时间
            uint256 expireTime;
        }
         */
    let projectVote = {
      serialNo,
      projectAddr: project.address,
      supportCount,
      opposeCount,
      voteRatio,
      expireTime,
      amount: 0,
    };

    let message = {
      ...projectVote,
      nonce,
      deadline,
    };
    
    let signature = await walletSign(project, "addProposal",coreskyHub.address, message);
    /**
  function applyProjectVote(Types.EIP712Signature calldata signature, 
    Types.Proposal calldata projectVote, 
    bytes memory botSignature) public {

 */
  // async function signProjectVote(serialNo, projectAddr, supportCount, opposeCount, voteRatio, expireTime, deadline)
    let botSignature =  await signProjectVote(serialNo, projectVote.projectAddr, supportCount, opposeCount, voteRatio, expireTime, deadline);
    await coreskyHub.connect(project).applyProjectVote(signature, projectVote,botSignature);

    //     function project(uint256 _groupID, address pro) public view virtual returns (address) 
    let projectAdd = await coreskyHub.project(groupID, project.address);
    console.log("coreskyHub.projectAdd", projectAdd);
    console.log("coreskyHub.isProject", await coreskyHub.isProject(projectAdd));
  });

  it("coreskyHub-deployApNFT-project【Yes permission】", async function () {
    const { admin, operator, bob } = await signer();
    /**
   function deployApNFT(
        uint256 apNftNo,
        string memory _name,
        string memory _symbol,
        string memory _baseUri
    ) 
 */
    let now = parseInt(new Date().getTime() / 1000);
    apNftNo = now;
    let deadline = now + 20000;

    let botSignature =  await signDeployApNFT(apNftNo, _name, _symbol, _baseUri, deadline);
    let tx = await coreskyHub.connect(bob).deployApNFT(apNftNo, _name, _symbol, _baseUri, deadline, botSignature);

    // let data = await tx.wait();

    // console.log(data.events)

    let deployedAddress = await coreskyHub.getApNFT(apNftNo);

    const TestMockNFT721 = await ethers.getContractFactory("AssetPackagedNFTUpgradeable");
    nft721 = await TestMockNFT721.attach(deployedAddress);

    console.log("TestMockNFT721 deployed to:", nft721.address);

    let adminRole = await nft721.DEFAULT_ADMIN_ROLE();
    let minterRole = await nft721.MINTER_ROLE();
    console.log("TestMockNFT721 DEFAULT_ADMIN_ROLE:", adminRole);
    console.log("TestMockNFT721 MINTER_ROLE:", minterRole);

    let minter = operator.address;
    console.log("TestMockNFT721 grantRole[MINTER_ROLE] before:", minter, await nft721.hasRole(minterRole, minter));

    // 为账户2增加minter权限
    // await nft721.grantRole(minterRole, minter);
    await coreskyHub.setContractRole(nft721.address, minterRole, minter);

    console.log("TestMockNFT721 grantRole[MINTER_ROLE] after:", minter, await nft721.hasRole(minterRole, minter));
  });

  it("coreskyHub-deployApNFT-otherproject【No permission】", async function () {
    const { admin, operator, bob, sam } = await signer();
    /**
   function deployApNFT(
        uint256 apNftNo,
        string memory _name,
        string memory _symbol,
        string memory _baseUri
    ) 
 */
    let now = parseInt(new Date().getTime() / 1000);
    apNftNo = now;
    let deadline = now + 20001;

    let botSignature =  await signDeployApNFT(apNftNo, _name, _symbol, _baseUri, deadline);
    let tx = coreskyHub.connect(sam).deployApNFT(apNftNo, _name, _symbol, _baseUri, deadline, botSignature);

    await (0, chai.expect)(tx).to.be.revertedWith(
      "AccessControl: account 0x90f79bf6eb2c4f870365e785982e1f101e93b906 is missing role 0xb3d19185cc5da0f783bf2dc17f221e4b5a21bf13b3727f3906f6d0e9185ca852"
    );
  });

  it("coreskyHub-setBackFeeToAndFee", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    console.log("CoreskyHub set Before backFeeTo:", await coreskyHub.backFeeTo(), await coreskyHub.backFee());
    // 设置用户退款地址和费率
    await coreskyHub.connect(operator).setBackFeeTo(operator.address);
    await coreskyHub.connect(operator).setBackFee(100);
    console.log("CoreskyHub set Before backFeeTo:", await coreskyHub.backFeeTo(), await coreskyHub.backFee());
  });

  it("coreskyHub-setFeeToAndFee", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    console.log("CoreskyHub set Before project FeeTo:", await coreskyHub.feeTo(), await coreskyHub.fee());
    // 设置用户退款地址和费率
    await coreskyHub.connect(operator).setFeeTo(operator.address);
    // await coreskyHub.connect(operator).setFee(100);
    console.log("CoreskyHub set Before project FeeTo:", await coreskyHub.feeTo(), await coreskyHub.fee());
  });

  it("coreskyHub-createAllocation", async function () {
    const { admin, operator, bob } = await signer();
    /**
         function createAllocation(
          uint256 _roundID, 
          address _target, 
          address _payment, 
          uint256 _nftPrice, 
          uint256 _startTime, 
          uint256 _endTime)
          public onlyRole(OPERATOR_ROLE) {
    ) 
 */
    let _roundID = lpid;
    let _target = nft721.address;
    let _receipt = operator.address;
    let _payment = zeroAddress();
    let _nftPrice = 2000;
    let now = parseInt(new Date().getTime() / 1000);
    let _startTime = now - 60;
    let _endTime = now + 3600;
    let _voteEndTime = _endTime + 60;
    let _mintEndTime = _voteEndTime + 60;
    let _totalQuantity = 200;
    console.log(
      "createAllocation param:",
      _roundID,
      _target,
      _receipt,
      _payment,
      _nftPrice,
      _startTime,
      _endTime,
      _voteEndTime,
      _mintEndTime,
      _totalQuantity,
      " coreskyHub.address:",
      coreskyHub.address
    );
    let tx = await coreskyHub.connect(bob).createAllocation(groupID, _roundID, _target,_receipt, _payment, _nftPrice, _startTime, _endTime, _voteEndTime, _mintEndTime, _totalQuantity);

    let data = await tx.wait();

    // console.log(data)

    let deployedAddress = await coreskyHub.getAllocation(_roundID);

    const TestMockLaunchpad = await ethers.getContractFactory("AllocationUpgradeable");
    launchpad = await TestMockLaunchpad.attach(deployedAddress);

    let project = await launchpad.getProject(_roundID);

    console.log(
      "Launchpad project:",
      project[0],
      "receipt",
      project[1],
      "payment",
      project[2],
      "nftPrice",
      n(project[3]),
      "totalSales",
      n(project[4]),
      "startTime",
      n(project[5]),
      "endTime",
      n(project[6])
    );

    let total = await coreskyHub.getTotalQuantity(_roundID);
    console.log("Launchpad getTotalQuantity:", total);

    console.log("LP :", launchpad.address, "Balance:", await erc20token.balances(launchpad.address));

    console.log("LP :", launchpad.address, "FundraisingStatus:", await launchpad.getFundraisingStatus(lpid));
  });

  it("coreskyHub-createAllocation-ExceedMaxAllocationLimit", async function () {
    const { admin, operator, bob } = await signer();
    /**
         function createAllocation(
          uint256 _roundID, 
          address _target, 
          address _payment, 
          uint256 _nftPrice, 
          uint256 _startTime, 
          uint256 _endTime)
          public onlyRole(OPERATOR_ROLE) {
    ) 
 */
    let _roundID = lpid + 1;
    let _target = nft721.address;
    let _receipt = operator.address;
    let _payment = zeroAddress();
    let _nftPrice = 2000;
    let now = parseInt(new Date().getTime() / 1000);
    let _startTime = now - 60;
    let _endTime = now + 3600;
    let _voteEndTime = _endTime + 60;
    let _mintEndTime = _voteEndTime + 60;
    let _totalQuantity = 200;

    let tx = await coreskyHub.connect(bob).createAllocation(groupID, _roundID, _target,_receipt, _payment, _nftPrice, _startTime, _endTime, _voteEndTime, _mintEndTime, _totalQuantity);

    _roundID = lpid + 2;

    tx = coreskyHub.connect(bob).createAllocation(groupID, _roundID, _target,_receipt, _payment, _nftPrice, _startTime, _endTime, _voteEndTime, _mintEndTime, _totalQuantity);

    await (0, chai.expect)(tx).to.be.revertedWith( `ExceedMaxAllocationLimit`);
  });

  it("coreskyHub-createAllocation-operator-nolimit", async function () {
    const { admin, operator, bob } = await signer();
    let _target = nft721.address;
    let _receipt = operator.address;
    let _payment = zeroAddress();
    let _nftPrice = 2000;
    let now = parseInt(new Date().getTime() / 1000);
    let _startTime = now - 60;
    let _endTime = now + 3600;
    let _voteEndTime = _endTime + 60;
    let _mintEndTime = _voteEndTime + 60;
    let _totalQuantity = 200;
    // 授权为操作者，可以无限创建
    let operatorRole = await coreskyHub.OPERATOR_ROLE();
    // 项目授权
    await coreskyHub.grantRole(operatorRole, bob.address);

    for(let i=0;i< 10;i++){
      let _roundID = lpid + i + 2;
      let tx = await coreskyHub.connect(bob).createAllocation(groupID, _roundID, _target,_receipt, _payment, _nftPrice, _startTime, _endTime, _voteEndTime, _mintEndTime, _totalQuantity);
    }
  });

  it("coreskyHub-createAllocation other group", async function () {
    const { admin, operator, bob } = await signer();
    /**
         function createAllocation(
          uint256 _roundID, 
          address _target, 
          address _payment, 
          uint256 _nftPrice, 
          uint256 _startTime, 
          uint256 _endTime)
          public onlyRole(OPERATOR_ROLE) {
    ) 
 */
    let _groupID = 2;
    let _roundID = lpid;
    let _target = nft721.address;
    let _receipt = operator.address;
    let _payment = zeroAddress();
    let _nftPrice = 2000;
    let now = parseInt(new Date().getTime() / 1000);
    let _startTime = now - 60;
    let _endTime = now + 3600;
    let _voteEndTime = _endTime + 60;
    let _mintEndTime = _voteEndTime + 60;
    let _totalQuantity = 200;
    console.log(
      "createAllocation param:",
      _roundID,
      _target,
      _receipt,
      _payment,
      _nftPrice,
      _startTime,
      _endTime,
      _voteEndTime,
      _mintEndTime,
      _totalQuantity,
      " coreskyHub.address:",
      coreskyHub.address
    );
    
    let projectRole = await coreskyHub.PROJECT_ROLE();
    // 0x99b4cb81d693045578a6795d2045a8e4a6dc2d789bd539397ae2ce05c6604599
    console.log("PROJECT_ROLE:", projectRole);
    let tx = coreskyHub.connect(bob).createAllocation(_groupID, _roundID, _target,_receipt, _payment, _nftPrice, _startTime, _endTime, _voteEndTime, _mintEndTime, _totalQuantity);
    
    let project = await coreskyHub.project(_groupID, bob.address);
    await (0, chai.expect)(tx).to.be.revertedWith(
      `AccessControl: account ${project.toLocaleLowerCase()} is missing role ${projectRole}`
    );

  });

  it("coreskyHub-setContractRole-【Alloction can be operater ApNFT】", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    let adminRole = await nft721.DEFAULT_ADMIN_ROLE();
    let minterRole = await nft721.MINTER_ROLE();
    console.log("TestMockNFT721 DEFAULT_ADMIN_ROLE:", adminRole);
    console.log("TestMockNFT721 MINTER_ROLE:", minterRole);

    // 设置NFT授权-Allocation可操控NFT
    await coreskyHub.setContractRole(nft721.address, minterRole, launchpad.address);
  });

  it("coreskyHub-setAutoMint-【automint=ture】", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function setAutoMint(address targetAllocation, bool _autoMint) public onlyRole(OPERATOR_ROLE) {
    ) 
 */
    console.log("setAutoMint before:", await launchpad.autoMintApNFT());
    await coreskyHub.connect(operator).setAutoMint(launchpad.address, true);
    console.log("setAutoMint  after:", await launchpad.autoMintApNFT());
  });

  it("preSale and auto mint【automint=ture】", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function preSale(
        uint256 roundID,
        uint256 preSaleID,
        uint256 preSaleNum,
        uint256 voteNum)
    ) public payable
    ) 
 */
    console.log("current user:", user.address);
    let roundID = lpid;
    let preSaleID = parseInt(new Date().getTime() / 1000) - 2;
    let preSaleNum = 2;
    let voteNum = 1;

    let owner = user.address;
    let _price = 2000 * preSaleNum;
    console.log("preSale param:", roundID, preSaleID, preSaleNum, owner, _price);
    let tx = await launchpad.connect(user).preSale(roundID, preSaleID, preSaleNum, voteNum, {
      from: owner,
      value: _price,
    });

    const {events} = await tx.wait();
    // console.log("tx events:", events);
    // 记录预售记录
    await eventTransferMint(presaleUsers, events);
         
    let project = await launchpad.getProject(roundID);

    console.log(
      "Launchpad project:",
      project[0],
      "receipt",
      project[1],
      "payment",
      project[2],
      "nftPrice",
      n(project[3]),
      "totalSales",
      n(project[4]),
      "startTime",
      n(project[5]),
      "endTime",
      n(project[6])
    );
    console.log("LP :", launchpad.address, "Balance:", await erc20token.balances(launchpad.address));

    console.log("LP Presale num:", await launchpad.getPreSaleNum(user.address, preSaleID));
    console.log("user nft balanceOf before:", n(await nft721.balanceOf(user.address)));

    ////////////////////////////////
    let nonce = parseInt(await coreskyHub.connect(user).nonce());
    let now = parseInt(new Date().getTime() / 1000);
    let deadline = now + 5 * 60;
    // preSaleNum = await launchpad.getPreSaleNum(user.address, preSaleID);
    let message = {
      roundID,
      allocationAddr: launchpad.address,
      mintNum: preSaleNum,
      nonce,
      deadline,
    };
    
    let signature = await walletSign(user, "apNftMint",coreskyHub.address, message);
    tx = coreskyHub.connect(user).apNftMint(signature, lpid);
    await (0, chai.expect)(tx).to.be.revertedWith( "MinNotStarted");
  });

  it("preSale and click mint【automint=ture】", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function preSale(
        uint256 roundID,
        uint256 preSaleID,
        uint256 preSaleNum, 
        uint256 voteNum)
    ) public payable
    ) 
 */
    console.log("current user:", user.address);
    let roundID = lpid;
    let preSaleID = parseInt(new Date().getTime() / 1000);
    let preSaleNum = 2;
    let voteNum = 1;

    let owner = user.address;
    let _price = 2000 * preSaleNum;
    console.log("preSale param:", roundID, preSaleID, preSaleNum, owner, _price);
    let tx = await launchpad.connect(user).preSale(roundID, preSaleID, preSaleNum, voteNum, {
      from: owner,
      value: _price,
    });

    const {events} = await tx.wait();
    // console.log("tx events:", events);
    // 记录预售记录
    await eventTransferMint(presaleUsers, events);
    
    let project = await launchpad.getProject(roundID);

    console.log(
      "Launchpad project:",
      project[0],
      "receipt",
      project[1],
      "payment",
      project[2],
      "nftPrice",
      n(project[3]),
      "totalSales",
      n(project[4]),
      "startTime",
      n(project[5]),
      "endTime",
      n(project[6])
    );
    console.log("LP :", launchpad.address, "Balance:", await erc20token.balances(launchpad.address));

    console.log("LP Presale num:", await launchpad.getPreSaleNum(user.address, preSaleID));

    console.log("user nft balanceOf before:", n(await nft721.balanceOf(user.address)));

  });

  it("coreskyHub-setAutoMint-【automint=false】", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function setAutoMint(address targetAllocation, bool _autoMint) public onlyRole(OPERATOR_ROLE) {
    ) 
 */
    console.log("setAutoMint before:", await launchpad.autoMintApNFT());
    await coreskyHub.connect(operator).setAutoMint(launchpad.address, false);
    console.log("setAutoMint  after:", await launchpad.autoMintApNFT());
  });

  it("preSale and click mint 【automint=false】", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function preSale(
        uint256 roundID,
        uint256 preSaleID,
        uint256 preSaleNum)
    ) public payable
    ) 
 */
    console.log("current user:", user.address);
    let roundID = lpid;
    let preSaleID = parseInt(new Date().getTime() / 1000) + 5;
    let preSaleNum = 2;
    let voteNum = 1;

    let owner = user.address;
    let _price = 2000 * preSaleNum;
    console.log("preSale param:", roundID, preSaleID, preSaleNum, owner, _price);
    let tx = await launchpad.connect(user).preSale(roundID, preSaleID, preSaleNum, voteNum, {
      from: owner,
      value: _price,
    });

    // let data = await tx.wait();
    // console.log("tx:", data);
    let project = await launchpad.getProject(roundID);

    console.log(
      "Launchpad project:",
      project[0],
      "receipt",
      project[1],
      "payment",
      project[2],
      "nftPrice",
      n(project[3]),
      "totalSales",
      n(project[4]),
      "startTime",
      n(project[5]),
      "endTime",
      n(project[6])
    );
    console.log("LP :", launchpad.address, "Balance:", await erc20token.balances(launchpad.address));

    console.log("LP Presale num:", await launchpad.getPreSaleNum(user.address, preSaleID));

    console.log("user nft balanceOf before:", n(await nft721.balanceOf(user.address)));

    console.log("===================set vote end time > now 【Mint not started】========================");

    ////////////////////////////////
    let nonce = parseInt(await coreskyHub.connect(user).nonce());
    let now = parseInt(new Date().getTime() / 1000);
    let deadline = now + 5 * 60;

    // preSaleNum = await launchpad.getPreSaleNum(user.address, preSaleID);

    let message = {
      roundID,
      allocationAddr: launchpad.address,
      mintNum: preSaleNum,
      nonce,
      deadline,
    };
    let signature = await walletSign(user, "apNftMint",coreskyHub.address, message);
    
    tx = coreskyHub.connect(user).apNftMint(signature, lpid);
    
    await (0, chai.expect)(tx).to.be.revertedWith( "MinNotStarted");

    console.log("===================set vote end time < now ========================");
    // 设置二次投票时间已结束=Mint开始
    await coreskyHub.connect(operator).setVoteEndTime(lpid, parseInt(new Date().getTime() / 1000) - 20);
    console.log("===================set mint end time < now ========================");
    // 设置Mint结束时间
    await coreskyHub.connect(operator).setMintEndTime(lpid, parseInt(new Date().getTime() / 1000) - 20);

    tx = coreskyHub.connect(user).apNftMint(signature, lpid);
    await (0, chai.expect)(tx).to.be.revertedWith( "MintHasEnded");
    console.log("===================Mint has ended ========================");

    // 设置二次投票时间已结束=Mint开始
    await coreskyHub.connect(operator).setVoteEndTime(lpid, 0);
    console.log("===================set mint end time = 0 ========================");
    // 设置Mint结束时间
    await coreskyHub.connect(operator).setMintEndTime(lpid, 0);
    console.log("===================set mint end time = 0 ========================");

    tx = await coreskyHub.connect(user).apNftMint(signature, lpid);
    
    const {events} = await tx.wait();
    // console.log("tx events:", events);
    // 记录预售记录
    await eventTransferMint(presaleUsers, events);
    console.log("user nft balanceOf minted:", n(await nft721.balanceOf(user.address)));

    // tx = coreskyHub.connect(user).apNftMint(signature, lpid);
    // await (0, chai.expect)(tx).to.be.revertedWith( "AlreadyMint");
  });

  it("coreskyHub-setTotalQuantity-operator", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function setTotalQuantity(
      uint256 _roundID, 
      uint256 _totalQuantity) external onlyRole(OPERATOR_ROLE) {
 */

    let roundID = lpid;
    // function getTotalQuantity(uint256 _roundID)
    console.log("TotalQuantity Before:", await launchpad.getTotalQuantity(roundID));

    // function isAllowOversold(uint256 _roundID)
    console.log("isAllowOversold Before:", await launchpad.isAllowOversold(roundID));
    let _totalQuantity = 20;
    let tx = await coreskyHub.connect(operator).setTotalQuantity(roundID, _totalQuantity, {
      from: operator.address,
      value: 0,
    });

    // console.log("TotalQuantity ret:", await tx.wait());

    // function getTotalQuantity(uint256 _roundID)
    console.log("TotalQuantity After:", await launchpad.getTotalQuantity(roundID));

    // function isAllowOversold(uint256 _roundID)
    console.log("isAllowOversold After:", await launchpad.isAllowOversold(roundID));

    // function getProjectTotalSales(uint256 _roundID)
    console.log("getProjectTotalSales:", await launchpad.getProjectTotalSales(roundID));
  });

  it("setTotalQuantity-project-AccessControl: account is missing role", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function setTotalQuantity(
      uint256 _roundID, 
      uint256 _totalQuantity) external onlyRole(OPERATOR_ROLE) {
 */

    let roundID = lpid;
    // function getTotalQuantity(uint256 _roundID)
    console.log("TotalQuantity Before:", await launchpad.getTotalQuantity(roundID));

    // function isAllowOversold(uint256 _roundID)
    console.log("isAllowOversold Before:", await launchpad.isAllowOversold(roundID));
    let _totalQuantity = 5;
    let tx = launchpad.connect(bob).setTotalQuantity(roundID, _totalQuantity, {
      from: bob.address,
      value: 0,
    });

    // await (0, chai.expect)(tx).to.be.revertedWithCustomError(allocationNFT, "AlreadyClaimed");
    await (0, chai.expect)(tx).to.be.revertedWith(
      "AccessControl: account 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc is missing role 0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929"
    );
    // console.log("TotalQuantity ret:", await tx.wait());
  });

  it("preSale-limitPreSale", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function preSale(
        uint256 roundID,
        uint256 preSaleID,
        uint256 preSaleNum)
    ) public payable
    ) 
 */
    console.log("current user:", user.address);
    let roundID = lpid;
    let preSaleID = parseInt(new Date().getTime() / 1000) + 1;
    // limit
    let preSaleNum = 20;
    // let preSaleNum = 10;
    let voteNum = 1;

    let owner = user.address;
    let _price = 2000 * preSaleNum;
    console.log("preSale param:", roundID, preSaleID, preSaleNum, owner, _price);
    let tx = launchpad.connect(user).preSale(roundID, preSaleID, preSaleNum, voteNum, {
      from: owner,
      value: _price,
    });
    // let data = await tx.wait();
    // console.log("tx:", data);

    await (0, chai.expect)(tx).to.be.revertedWith("The LaunchPad activity has sold out");

    // let getPreSaleLog = await launchpad.getPreSaleLog(roundID);
    // console.log("getPreSaleLog:", getPreSaleLog);

    // let project = await launchpad.getProject(roundID);

    // console.log("Launchpad project:", project[0], "receipt", project[1], "payment", project[2], "nftPrice", n(project[3]), "totalSales", n(project[4]), "startTime", n(project[5]), "endTime", n(project[6]));
  });

  it("pause-launchpad", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function pause(uint256 _roundID) public whenNotPaused(_roundID) onlyRole(OPERATOR_ROLE) 
 */

    let roundID = lpid;
    // function paused(uint256 _roundID)
    console.log("pause Before:", await launchpad.paused(roundID));

    let tx = await coreskyHub.connect(operator).pause(roundID, {
      from: operator.address,
      value: 0,
    });

    // console.log("pause ret:", await tx.wait());

    // function paused(uint256 _roundID)
    console.log("pause After:", await launchpad.paused(roundID));
  });

  it("paused-PreSale", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function preSale(
        uint256 roundID,
        uint256 preSaleID,
        uint256 preSaleNum)
    ) public payable
    ) 
 */
    console.log("current user:", user.address);
    let roundID = lpid;
    let preSaleID = parseInt(new Date().getTime() / 1000) + 1;
    // limit
    // let preSaleNum = 20;
    let preSaleNum = 2;
    let voteNum = 1;

    let owner = user.address;
    let _price = 2000 * preSaleNum;
    console.log("preSale param:", roundID, preSaleID, preSaleNum, owner, _price);
    let tx = launchpad.connect(user).preSale(roundID, preSaleID, preSaleNum, voteNum, {
      from: owner,
      value: _price,
    });

    // let data = await tx.wait();
    // console.log("tx:", data);

    await (0, chai.expect)(tx).to.be.revertedWith("Pausable: paused");
  });

  it("unpause-launchpad", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function unpause(uint256 _roundID) public whenNotPaused(_roundID) onlyRole(OPERATOR_ROLE) 
 */

    let roundID = lpid;
    // function paused(uint256 _roundID)
    console.log("unpause Before:", await launchpad.paused(roundID));

    let tx = await coreskyHub.connect(operator).unpause(roundID, {
      from: operator.address,
      value: 0,
    });

    // console.log("unpause ret:", await tx.wait());

    // function paused(uint256 _roundID)
    console.log("unpause After:", await launchpad.paused(roundID));
  });

  it("unpause-PreSale", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function preSale(
        uint256 roundID,
        uint256 preSaleID,
        uint256 preSaleNum)
    ) public payable
    ) 
 */
    console.log("current user:", user.address);
    let roundID = lpid;
    let preSaleID = parseInt(new Date().getTime() / 1000) + 2;
    // limit
    // let preSaleNum = 20;
    let preSaleNum = 9;
    let voteNum = 1;

    let owner = user.address;
    let _price = 2000 * preSaleNum;
    console.log("preSale param:", roundID, preSaleID, preSaleNum, owner, _price);
    let tx = await launchpad.connect(user).preSale(roundID, preSaleID, preSaleNum, voteNum, {
      from: owner,
      value: _price,
    });

    ////////////////////////////////
    let nonce = parseInt(await coreskyHub.connect(user).nonce());
    let now = parseInt(new Date().getTime() / 1000);
    let deadline = now + 5 * 60;

    // preSaleNum = await launchpad.getPreSaleNum(user.address, preSaleID);

    let message = {
      roundID,
      allocationAddr: launchpad.address,
      mintNum: preSaleNum,
      nonce,
      deadline,
    };
    let signature = await walletSign(user, "apNftMint",coreskyHub.address, message);
    
    tx =  await coreskyHub.connect(user).apNftMint(signature, lpid);
          
    const {events} = await tx.wait();
    // console.log("tx events:", events);
    // 记录预售记录
    await eventTransferMint(presaleUsers, events);

    let getPreSaleLog = await launchpad.getPreSaleLog(roundID);

    console.log("===================>>>getPreSaleLog:=======================");
    for (let i = 0; i < getPreSaleLog.length; i++) {
      console.log(
        "preSaleID:",
        n(getPreSaleLog[i].preSaleID),
        "preSaleUser:",
        getPreSaleLog[i].preSaleUser,
        "paymentTime:",
        n(getPreSaleLog[i].paymentTime),
        "preSaleNum:",
        n(getPreSaleLog[i].preSaleNum)
      );
    }

    console.log("getTotalQuantity:", n(await launchpad.getTotalQuantity(roundID)));
    console.log("getProjectTotalSales:", n(await launchpad.getProjectTotalSales(roundID)));
    // Returns project SoldOut status by the roundID.
    // function isSoldOut(uint256 _roundID) external view returns (bool)
    console.log("isSoldOut:", await launchpad.isSoldOut(roundID));
    let lpstatus = await launchpad.getLpStatus(roundID);
    // (round[_roundID].totalSales, totalQuantity[_roundID], allowOversold[_roundID], totalQuantity[_roundID] > 0 && round[_roundID].totalSales == totalQuantity[_roundID], _paused[_roundID]);
    console.log(
      "getLpStatus: totalSales",
      n(lpstatus[0]),
      "totalQuantity:",
      n(lpstatus[1]),
      "allowOversold:",
      lpstatus[2],
      "SoldOut:",
      lpstatus[3],
      "paused:",
      lpstatus[4]
    );

    console.log("LP :", launchpad.address, "Balance:", n(await erc20token.balances(launchpad.address)));
  });

  it("SoldOut-PreSale", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function preSale(
        uint256 roundID,
        uint256 preSaleID,
        uint256 preSaleNum)
    ) public payable
    ) 
 */
    console.log("current user:", user.address);
    let roundID = lpid;
    let preSaleID = parseInt(new Date().getTime() / 1000) + 2;
    // limit
    let preSaleNum = 20;
    // let preSaleNum = 1;
    let voteNum = 1;

    let owner = user.address;
    let _price = 2000 * preSaleNum;
    console.log("preSale param:", roundID, preSaleID, preSaleNum, owner, _price);
    let tx = launchpad.connect(user).preSale(roundID, preSaleID, preSaleNum, voteNum, {
      from: owner,
      value: _price,
    });

    // await (0, chai.expect)(tx).to.be.revertedWithCustomError(allocationNFT, "AlreadyClaimed");
    await (0, chai.expect)(tx).to.be.revertedWith("The LaunchPad activity has sold out");

    // let data = await tx.wait();
    // console.log("tx:", data);

    // let getPreSaleLog = await launchpad.getPreSaleLog(roundID);
    // console.log("getPreSaleLog:", getPreSaleLog);

    // console.log("getTotalQuantity:", await launchpad.getTotalQuantity(roundID));
    // console.log("getProjectTotalSales:", await launchpad.getProjectTotalSales(roundID));
    //     // Returns project SoldOut status by the roundID.
    //     // function isSoldOut(uint256 _roundID) external view returns (bool)
    //     console.log("isSoldOut:", await launchpad.isSoldOut(roundID));

    //     console.log("getLpStatus:", await launchpad.getLpStatus(roundID));
  });

  it("coreskyHub-refundFundraisingVote-【fundraisingStatus=2】-fail-【presaleRefund】", async function () {
    const { admin, operator, bob, sam, user, signBot } = await signer();
    let roundID = lpid;
    let vote = await launchpad.getProjectVote(roundID);
    console.log("getProjectVote: voteCount", n(vote[0]), "totalVote", n(vote[1]), "voteRatio", n(vote[2]));
    // 设置二次投票时间-进行中
    for(let i = 0; i< 10;i++){
      await coreskyHub.connect(signBot).presaleRefund(roundID);
    }
  });

  
  it("coreskyHub-depositIssueToken", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    let roundID = lpid;
    let _issueToken = issueToken.address;
    
    const network = await provider.getNetwork();
    const chainId = network.chainId;
    // 每nft发100代币
    const nftContainNum = 100_0000000000;

    const preSalesNum = await launchpad.getProjectTotalSales(roundID);

    let _price = nftContainNum * preSalesNum;
    let owner = bob.address;
    // get allowance
    // let allowaceBefore = await issueToken.allowance(owner, coreskyHub.address);
    // // approve
    // await issueToken.connect(bob).approve(coreskyHub.address, _price);
    // // get allowance
    // let allowaceAfter = await issueToken.allowance(owner, coreskyHub.address);

    
    // get allowance
    let allowaceBefore = await issueToken.allowance(owner, airdrops.address);
    // approve
    await issueToken.connect(bob).approve(airdrops.address, _price);
    // get allowance
    let allowaceAfter = await issueToken.allowance(owner, airdrops.address);

    console.log("depositIssueToken param:", roundID, _issueToken, chainId, nftContainNum, owner, "allowace:", allowaceBefore, allowaceAfter);
    
    console.log("getProjectTotalSales:", n(preSalesNum));

    console.log("getFundraisingStatus: ", await launchpad.getFundraisingStatus(roundID));
    
    // 项目方存入发行token
    console.log("depositIssueToken Before: ", await airdrops.getWithdrawableAmount(issueToken.address));
    /**
     *     function depositIssueToken(
      uint256 roundID,
      address issueToken,
      uint256 chainId,
      uint256 nftContainNum
  ) external onlyRole(PROJECT_ROLE) returns
     */
    // await coreskyHub.connect(bob).depositIssueToken(roundID, _issueToken, chainId, nftContainNum);
        /**
  function deposit(uint256 serialNo, address token, uint256 amount, uint256 deadline, bytes memory signature)
   */    
  let now = parseInt(new Date().getTime() / 1000);
  let deadline = now + 5 * 60;
  let serialNo = now
  let signature =  await signDeposit(serialNo, _issueToken, _price, deadline);
    
  await airdrops.connect(bob).deposit(serialNo, _issueToken, _price, deadline, signature);

    console.log("depositIssueToken After: ", await airdrops.getWithdrawableAmount(issueToken.address));
    
  });
  
  it("coreskyHub-refundFundraisingVote-【fundraisingStatus=1】-success-【sendFundraising】", async function () {
    const { admin, operator, bob, sam, user, signBot } = await signer();
    let roundID = lpid;
    let serialNo = "110001";
    let amount = 1000;
    let fee = 100;

    let total = n(await launchpad.thisBalance());
    if (total > 0) {
      let tiems = parseInt(total / amount);
      for (let i = 0; i < tiems; i++) {
        serialNo += i;
        // 项目方打款
        // console.log("Fundraising thisBalance Before: ", total);
        // console.log("Fundraising getWithdrawableAmount Before: ", await launchpad.getWithdrawableAmount(erc20token.address));
        // function sendFundraising(uint256 roundID, uint256 _serialNo, uint256 _amount, uint256 _fee) public payable onlyRole(OPERATOR_ROLE)
        await coreskyHub.connect(signBot).sendFundraising(roundID, serialNo, amount, fee);
        console.log("Fundraising thisBalance After: ", n(await launchpad.thisBalance()));
        console.log("operator Balance:", operator.address, (await operator.getBalance()).toString());
        
        // console.log("Fundraising getWithdrawableAmount After: ", await launchpad.getWithdrawableAmount(erc20token.address));
      }
    }

    let count = await launchpad.getFundraisingLength(roundID);
    console.log("getFundraisingLength: ", count);
    //  function getFundraisingByNo(uint256 roundID, uint256 _serialNo) public view returns (uint256, uint256,uint256,uint256)
    // (index, log.sendTime, log.amount, log.receiveAmount);
    console.log("getFundraisingByNo: ", await launchpad.getFundraisingByNo(roundID, serialNo));
    //  function getFundraisingByIndex(uint256 roundID, uint256 index) public view returns (uint256, uint256,uint256,uint256)
    // (index, log.sendTime, log.amount, log.receiveAmount);
    console.log("getFundraisingByIndex: ", await launchpad.getFundraisingByIndex(roundID, count - 1));
  });

  
  it("getProject", async function () {
    console.log("=====================getPoject info Print==========================");
    let roundID = lpid;

    let getPreSaleLog = await launchpad.getPreSaleLog(roundID);

    console.log("===================>>>getPreSaleLog:=======================");
    for (let i = 0; i < getPreSaleLog.length; i++) {
      console.log(
        "preSaleID:",
        n(getPreSaleLog[i].preSaleID),
        "preSaleUser:",
        getPreSaleLog[i].preSaleUser,
        "paymentTime:",
        n(getPreSaleLog[i].paymentTime),
        "preSaleNum:",
        n(getPreSaleLog[i].preSaleNum)
      );
    }
    // console.log("getPreSaleLog:", getPreSaleLog);
    console.log("getTotalQuantity:", n(await launchpad.getTotalQuantity(roundID)));
    console.log("getProjectTotalSales:", n(await launchpad.getProjectTotalSales(roundID)));
    // Returns project SoldOut status by the roundID.
    // function isSoldOut(uint256 _roundID) external view returns (bool)
    console.log("isSoldOut:", await launchpad.isSoldOut(roundID));
    let info = await launchpad.getProject(roundID);
    // project.target, project.receipt, project.payment, project.nftPrice, project.totalSales, project.startTime, project.endTime
    console.log(
      "getProject target:",
      info[0],
      "receipt",
      info[1],
      "payment",
      info[2],
      "nftPrice",
      n(info[3]),
      "totalSales",
      n(info[4]),
      "startTime",
      n(info[5]),
      "endTime",
      n(info[6])
    );
    console.log("getVoteEndTime:", n(await launchpad.getVoteEndTime(roundID)));
    console.log("getMintEndTime:", n(await launchpad.getMintEndTime(roundID)));
    console.log("=====================allocation token balance==========================");
    console.log("allocation token balance:", launchpad.address, "Balance:", n(await erc20token.balances(launchpad.address)));
    let vote = await launchpad.getProjectVote(roundID);
    console.log("getProjectVote: voteCount", n(vote[0]), "totalVote", n(vote[1]), "voteRatio", n(vote[2]));
    console.log("getFundraisingStatus: ", await launchpad.getFundraisingStatus(roundID));

    console.log("PresaleUser:", presaleUsers, "size:", presaleUsers.length);
  });

  let apNftVesting;
  it("depoly-ApNftVesting", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    let receivedAddress = admin.address;
    // _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    // _setupRole(MINTER_ROLE, _msgSender());
    const TestApNftVesting = await ethers.getContractFactory("ApNftVestingUpgradeable");

    /**
     *  address admin,
        address receivedAddress
     */

    // apNftVesting = await TestApNftVesting.deploy(admin.address, receivedAddress);
    apNftVesting = await upgrades.deployProxy(TestApNftVesting, [admin.address, receivedAddress]);
    
    await apNftVesting.deployed();

    console.log("TestApNftVesting deployed to:", apNftVesting.address);
    // let adminRole = await apNftVesting.DEFAULT_ADMIN_ROLE();
    // let operatorRole = await apNftVesting.OPERATOR_ROLE();
    // console.log("TestApNftVesting DEFAULT_ADMIN_ROLE:", adminRole);
    // console.log("TestApNftVesting OPERATOR_ROLE:", operatorRole);
  });

  it("user-apNftTransfer", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    let receivedAddress = admin.address;

    let _batchNo = 1;
    let _serialNo = 1;
    let _apNFTaddess = nft721.address;
    let _tokenID = 1;

    // 查询当前地址是否存在NFT
    console.log("receivedAddress ",receivedAddress, " balanceOf:", n(await nft721.balanceOf(receivedAddress)));
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

  it("Coresky-setApNftVesting", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    // 为账户4增加burner权限
    await coreskyHub.setApNftVesting(apNftVesting.address);
    
    console.log("Coresky-setApNftVesting:", await coreskyHub.getApNftVesting());
  });

  it("user-batchTransfer", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    let receivedAddress = admin.address;

    let _batchNo = 2;
    let _serialNos = [22,23,24,25];
    let _apNFTaddess = nft721.address;
    let _tokenIDs = [2,3,4,5];

    // 查询当前地址是否存在NFT
    console.log("receivedAddress ",receivedAddress, " balanceOf:", n(await nft721.balanceOf(receivedAddress)));
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

    // console.log("transaction: ",tx.hash);
    const {events} = await tx.wait();
    // console.log("tx.wait: ",ret.events);

    const datas = events.reduce((Transfer, { event, args }) => {
      // event ApNftTransfer(address indexed apNFTaddess, address indexed from, uint256 indexed tokenID, uint256 time, uint256 serialNo, uint256 batchNo);
      if(event === "ApNftTransfer"){
        Transfer.push({
          apNFTaddess: args.apNFTaddess,
          from: args.from, 
          tokenID:  n(args.tokenID), 
          time:  n(args.time), 
          serialNo: n(args.serialNo), 
          batchNo: n(args.batchNo)
        });
      }
      return Transfer;
  
    },[]);
  
    console.log("ApNftTransfer", datas);


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

  it("user-releaseToken", async function () {
    const { admin, operator, bob, sam, user, signBot } = await signer();

    let user1    = bob;
    let user2    = sam;
    let user3    = user;


    console.log("admin    balanceOf:",s(await issueToken.balanceOf(admin.address)));
    console.log("user1    balanceOf", s(await issueToken.balanceOf(user1.address)));
    console.log("user2    balanceOf", s(await issueToken.balanceOf(user2.address)));
    console.log("user3    balanceOf", s(await issueToken.balanceOf(user3.address)));
    console.log("operator balanceOf", s(await issueToken.balanceOf(operator.address)));
    console.log("coreskyHub balanceOf", s(await issueToken.balanceOf(coreskyHub.address)));

    /**
     * function releaseToken(
        uint256 _batchNo,
        address _tokenAddress,
        address[] calldata _to,
        uint256[] calldata _value,
        uint256[] calldata _serialNo
    ) 
     */
    let _batchNo = 1;
    let _tokenAddress = issueToken.address;
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

    let tx =  await airdrops.connect(signBot).releaseToken(_batchNo, _tokenAddress, _to, _value, _serialNo);
    console.log("admin    sendERC20 balanceOf:",s(await issueToken.balanceOf(admin.address)));
    console.log("user1    sendERC20 balanceOf", s(await issueToken.balanceOf(user1.address)));
    console.log("user2    sendERC20 balanceOf", s(await issueToken.balanceOf(user2.address)));
    console.log("user3    sendERC20 balanceOf", s(await issueToken.balanceOf(user3.address)));
    console.log("operator sendERC20 balanceOf", s(await issueToken.balanceOf(operator.address)));
    console.log("coreskyHub balanceOf", s(await issueToken.balanceOf(coreskyHub.address)));


    const {events} = await tx.wait();


    const datas = events.reduce((Transfer, { topics, data }) => {
      // event AirDropToken(address indexed token, address indexed to, uint256 indexed amount, 
      // uint256 time, uint256 searilNo, uint256 batchNo);
      if(topics[0] === AIRDROP_TOKEN_EVENT){

        let args = defaultAbiCoder.decode([ "uint256","uint256","uint256"], data)

        Transfer.push({
          token: defaultAbiCoder.decode([ "address"], topics[1])[0],
          to: defaultAbiCoder.decode([ "address"], topics[2])[0], 
          amount:  n(defaultAbiCoder.decode([ "uint256"], topics[3])[0]), 
          time:  n(args[0]), 
          serialNo: n(args[1]), 
          batchNo: n(args[2])
        });


      }

      return Transfer;
  
    },[]);
  
    console.log("AirDropToken", datas);


    // getApNFTDrop
    console.log("CoreskyAirDrop getApNFTDrop:", (await airdrops.getApNFTDrop(_serialNo[0])));

    // getBatchSerialNo
    console.log("CoreskyAirDrop getBatchSerialNo:", (await airdrops.getBatchSerialNo(_batchNo)));

  });

  it("Coresky-setGovernance", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    await coreskyHub.setGovernance(erc20token.address);
    
    console.log("Coresky-getGovernance:", await coreskyHub.getGovernance());
  });

  it("Coresky-setEmergencyAdmin", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    // 为账户4增加burner权限
    await coreskyHub.setEmergencyAdmin(admin.address);
    
    console.log("Coresky-getEmergencyAdmin:", await coreskyHub.getEmergencyAdmin());
  });


  it("Coresky-upgrade", async function () {
    const { admin, operator, bob } = await signer();

    console.log("coreskyHub          deployed to:", coreskyHub.address, "version:", (await coreskyHub.getRevision()));
    const upgradeableContractAddress = coreskyHub.address;
    const upgradeableV2Factory = await ethers.getContractFactory("CoreskyHubInitializable");
    coreskyHubUpdadeV2 = await upgrades.upgradeProxy(upgradeableContractAddress, upgradeableV2Factory);
    console.log("UpgrateableContract upgraded to V2 at:", coreskyHubUpdadeV2.address);
    
    console.log("upgradeableContract deployed to:", coreskyHubUpdadeV2.address, "version:", (await coreskyHubUpdadeV2.getRevision()));
  });


  it("getProject", async function () {
    console.log("=====================getPoject info Print==========================");
    let roundID = lpid;

    let getPreSaleLog = await launchpad.getPreSaleLog(roundID);

    console.log("===================>>>getPreSaleLog:=======================");
    for (let i = 0; i < getPreSaleLog.length; i++) {
      console.log(
        "preSaleID:",
        n(getPreSaleLog[i].preSaleID),
        "preSaleUser:",
        getPreSaleLog[i].preSaleUser,
        "paymentTime:",
        n(getPreSaleLog[i].paymentTime),
        "preSaleNum:",
        n(getPreSaleLog[i].preSaleNum)
      );
    }
    // console.log("getPreSaleLog:", getPreSaleLog);
    console.log("getTotalQuantity:", n(await launchpad.getTotalQuantity(roundID)));
    console.log("getProjectTotalSales:", n(await launchpad.getProjectTotalSales(roundID)));
    // Returns project SoldOut status by the roundID.
    // function isSoldOut(uint256 _roundID) external view returns (bool)
    console.log("isSoldOut:", await launchpad.isSoldOut(roundID));
    let info = await launchpad.getProject(roundID);
    // project.target, project.receipt, project.payment, project.nftPrice, project.totalSales, project.startTime, project.endTime
    console.log(
      "getProject target:",
      info[0],
      "receipt",
      info[1],
      "payment",
      info[2],
      "nftPrice",
      n(info[3]),
      "totalSales",
      n(info[4]),
      "startTime",
      n(info[5]),
      "endTime",
      n(info[6])
    );
    console.log("getVoteEndTime:", n(await launchpad.getVoteEndTime(roundID)));
    console.log("getMintEndTime:", n(await launchpad.getMintEndTime(roundID)));
    console.log("=====================allocation token balance==========================");
    console.log("allocation token balance:", launchpad.address, "Balance:", n(await erc20token.balances(launchpad.address)));
    let vote = await launchpad.getProjectVote(roundID);
    console.log("getProjectVote: voteCount", n(vote[0]), "totalVote", n(vote[1]), "voteRatio", n(vote[2]));
    console.log("getFundraisingStatus: ", await launchpad.getFundraisingStatus(roundID));

    console.log("PresaleUser:", presaleUsers, "size:", presaleUsers.length);
  });

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


async function blockTime() {
  const block = await web3.eth.getBlock("latest");
  return block.timestamp;
}

async function snapshot() {
  return ethereum.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return ethereum.send("evm_revert", [snapshotId]);
}

async function forceMine() {
  return ethereum.send("evm_mine", []);
}

/**
 * sign
 * @param {*} _signer 
 * @param {*} nonce 
 * @param {*} type 
 * @param {*} verifyContract 
 * @param {*} message 
 * @returns 
 */
async function walletSign(_signer, type, verifyContract, message ){
  // let _signer = user;
  const network = await provider.getNetwork();
  const chainId = network.chainId;
  console.log("chainId = ", network.chainId);

  ////////////////////////////////
  // let nonce = parseInt(await coreskyHub.nonce())  + 1;
  // let now = parseInt(new Date().getTime() / 1000);
  // let deadline = now + 5 * 60;

  // let message = {
  //   roundID,
  //   preSaleID,
  //   allocationAddr: launchpad.address,
  //   preSaleNum,
  //   nonce,
  //   deadline,
  // };

  // let verifyContract = coreskyHub.address;
  let msgParams = signTypedData(chainId, verifyContract, type, message);

  // console.log("==>>msgParams", msgParams);
  const sign = await _signer._signTypedData(msgParams.domain, msgParams.types, msgParams.message);

  console.log(`signature = `, sign);
  // 如果是metmask插件，可以调用下面的方法
  // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);

  const jsRecoveredAddr = utils.verifyTypedData(msgParams.domain, msgParams.types, msgParams.message, sign);

  chai.expect(await _signer.address.toUpperCase()).to.equal(jsRecoveredAddr.toUpperCase());

  // const sig = ecsign(digest, privateKey);

  /**
   *     struct EIP712Signature {
          address signer;
          uint8 v;
          bytes32 r;
          bytes32 s;
          uint256 deadline;
      }
   */
  const _sign = splitSignature(sign);
  let signature = {
    signer: _signer.address,
    v: _sign.v,
    r: _sign.r,
    s: _sign.s,
    deadline: message.deadline,
  };

  return signature;

}

async function eventTransferMint(presaleUsers, events){
  // let transfer = ;
  // const args = events.find(({ event }) => event === 'PreSaleClaimed').args
  // console.log("PreSaleClaimed", n(args.roundID), args.sender,n(args.preSaleID),n(args.preSaleNum));
  
  const topics = events.reduce((Transfer, { topics }) => {
    // event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    if(topics[0] === TRANSTER_EVENT){
      Transfer.push({
        from: defaultAbiCoder.decode([ "address"], topics[1])[0], 
        to: defaultAbiCoder.decode([ "address"], topics[2])[0], 
        tokenId: defaultAbiCoder.decode([ "uint256"], topics[3])[0]
      });
      presaleUsers.push({
        presaleUser: defaultAbiCoder.decode([ "address"], topics[2])[0], 
        tokenId: defaultAbiCoder.decode([ "uint256"], topics[3])[0]
      });
    }
    return Transfer;

  },[]);

  console.log("TRANSTER_EVENT",TRANSTER_EVENT, topics);
}

const deploymentConfig = {
  PERIOD_DURATION_IN_SECONDS: 17280,
  VOTING_DURATON_IN_PERIODS: 35,
  GRACE_DURATON_IN_PERIODS: 35,
  PROPOSAL_DEPOSIT: 10,
  DILUTION_BOUND: 3,
  PROCESSING_REWARD: 1,
  TOKEN_SUPPLY: 10000,
};

async function moveForwardPeriods(periods) {
  console.log("before bolckTime", await blockTime());
  const goToTime = deploymentConfig.PERIOD_DURATION_IN_SECONDS * periods;
  await ethereum.send("evm_increaseTime", [goToTime]);
  await forceMine();
  console.log(" after bolckTime", await blockTime());
  return true;
}

async function signer() {
  
  
  const [admin, operator, bob, sam, user, user2] = await ethers.getSigners();

  
  const signBot = new ethers.Wallet(SIGN_PRI, provider);

  const signBotBalance = await signBot.getBalance();
  if(signBotBalance == 0){
    console.log("admin    balance:",  (await admin.getBalance()).toString());
    console.log("signBot  balance:",  signBotBalance.toString());
    await sendEth(admin, signBot.address, "10");  
    console.log("admin    balance:",  (await admin.getBalance()).toString());
    console.log("signBot  balance:",  (await signBot.getBalance()).toString());
  }

  return { admin, operator, bob, sam, user, user2, signBot };
}


async function sendEth(signer, to, amount){
    let tx = {
      to,
      // ... or supports ENS names
      // to: "ricmoo.firefly.eth",

      // We must pass in the amount as wei (1 ether = 1e18 wei), so we
      // use this convenience function to convert ether to wei.
      value: ethers.utils.parseEther(amount)
  };
  let sendPromise = signer.sendTransaction(tx);

  sendPromise.then((tx) => {
      // console.log("ETH sendTransaction", tx);
      // {
      //    // All transaction fields will be present
      //    "nonce", "gasLimit", "pasPrice", "to", "value", "data",
      //    "from", "hash", "r", "s", "v"
      // }
  });
}