const {
  deploy,
  gasCalculate,
  getDeployed,
  getDeployedInstance,
} = require("./deploy.js");
const chai = require("chai");

const { ethers, artifacts, ethereum, web3 } = require("hardhat");

const { encrypt, recoverPersonalSignature, recoverTypedSignatureLegacy, signTypedDataLegacy, recoverTypedSignature, recoverTypedSignature_v4 } = require("eth-sig-util");

const { BigNumber, utils, provider } = ethers;
const { zeroAddress, bufferToHex, keccakFromString, privateToAddress, ecsign } = require("ethereumjs-util");
const { structHash, signHash, signTypedData, signDeposit, signDeployApNFT } = require("./signCoreskyHub.js");
const { Signer } = require("ethers");
const { hexStripZeros, solidityPack, concat, toUtf8Bytes, keccak256, SigningKey, formatBytes32String, joinSignature, splitSignature, defaultAbiCoder } = utils;
const {
  SIGN_PUB,
  SIGN_PRI
} = process.env;

const TRANSTER_EVENT = keccak256(toUtf8Bytes("Transfer(address,address,uint256)"));
const AIRDROP_TOKEN_EVENT = keccak256(toUtf8Bytes("AirDropToken(address,address,uint256,uint256,uint256,uint256)"));


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

describe("Allocation-test", function () {
  let lpid = 256;
  let presaleUsers = [];
  let accounts;
  let metaTxLib;
  let coreskyHub;
  let launchpad;
  let nft721;
  let apNftNo;
  let leaves;
  let treeRoot;
  let leaves500;
  let treeRoot500;
  let vipLeaves;
  let vipTreeRoot;
  // 5.创建ERC20合约
  let erc20TransferProxy;
  // Goerli USDT token (owner:0x12406A2a835A388192a5B0a63Db06F15dD4e3c32)
  // 0x5BD32a1FF0fEA199c7B9d79442d776fdA731d1D4
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

    let mocker = accounts[0].address;

    let minter = accounts[1].address;

    let user = accounts[4].address;

    const TestMetaTxLib = await ethers.getContractFactory("MetaTxLib");
    metaTxLib = await TestMetaTxLib.deploy();
    await metaTxLib.deployed();
    const TestAllocationLib = await ethers.getContractFactory("AllocationLib");
    let allocationLib = await TestAllocationLib.deploy();
    await allocationLib.deployed();

    const TestApNftLib = await ethers.getContractFactory("ApNftLib");
    let apNftLib = await TestApNftLib.deploy();
    await apNftLib.deployed();


    const TestCoreskyHub = await ethers.getContractFactory("CoreskyHub", {
      libraries: {
        MetaTxLib: metaTxLib.address,
        AllocationLib: allocationLib.address,
        ApNftLib: apNftLib.address,
        // Types: _types.address
      },
    });


    const TetherToken = await ethers.getContractFactory("TetherToken");

    // TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals)
    erc20token = await TetherToken.deploy("10000000000000000", "USD", "USDT", 6);
    await erc20token.deployed();
    let totalSupply = await erc20token.totalSupply();

    console.log("USDT:", erc20token.address, "totalSupply:", totalSupply);
    console.log("admin Balance:", admin.address, await erc20token.balances(admin.address));
    // 为账号0x51A41BA1Ce3A6Ac0135aE48D6B92BEd32E075fF0 转移10000
    await erc20token.transfer(user, 10000000000);
    console.log("user Balance:", user, await erc20token.balances(user));

    /**
     * constructor(address root, address creator) {
        _setupRole(DEFAULT_ADMIN_ROLE, root);
        _grantRole(CREATE_ROLE, creator);
    }
     */
    coreskyHub = await TestCoreskyHub.deploy(admin.address, operator.address, SIGN_PUB);
    await coreskyHub.deployed();

    console.log("coreskyHub address:", coreskyHub.address);
    let PlatformAllocationAddress = await coreskyHub.getPlatformAllocation();
    console.log("PlatformAllocation address:", PlatformAllocationAddress);

    const TestMockLaunchpad = await ethers.getContractFactory("Allocation");
    if(PlatformAllocationAddress===zeroAddress()){
      launchpad = await TestMockLaunchpad.deploy(admin.address, operator.address);
      // 设置PlatformAllocation地址
      await coreskyHub.setPlatformAllocation(launchpad.address);
      PlatformAllocationAddress = await coreskyHub.getPlatformAllocation();
      console.log("PlatformAllocation new address:", PlatformAllocationAddress);
    }else{
      launchpad = await TestMockLaunchpad.attach(PlatformAllocationAddress);
    }
    
    let operatorRole = await launchpad.OPERATOR_ROLE();
    await launchpad.grantRole(operatorRole, coreskyHub.address);

  });

  let airdrops;
  it("depoly-CoreskyAirDrop", async function () {
    const { admin, operator, bob, sam, user} = await signer();
    // _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    // _setupRole(MINTER_ROLE, _msgSender());
    const TestMockAirDrop = await ethers.getContractFactory("CoreskyAirDrop");

    airdrops = await TestMockAirDrop.deploy(admin.address, operator.address);
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
    let tx = await coreskyHub.connect(operator).deployApNFT(apNftNo, _name, _symbol, _baseUri, deadline, botSignature);

    // let data = await tx.wait();

    // console.log(data.events)

    let deployedAddress = await coreskyHub.getApNFT(apNftNo);

    const TestMockNFT721 = await ethers.getContractFactory("AssetPackagedNFT");
    nft721 = await TestMockNFT721.attach(deployedAddress);

    console.log("TestMockNFT721 deployed to:", nft721.address);

    let adminRole = await nft721.DEFAULT_ADMIN_ROLE();
    let minterRole = await nft721.MINTER_ROLE();
    console.log("TestMockNFT721 DEFAULT_ADMIN_ROLE:", adminRole);
    console.log("TestMockNFT721 MINTER_ROLE:", minterRole);

    // let minter = operator.address;
    // console.log("TestMockNFT721 grantRole[MINTER_ROLE] before:", minter, await nft721.hasRole(minterRole, minter));

    // 为账户2增加minter权限
    // await nft721.grantRole(minterRole, minter);
    // await coreskyHub.setContractRole(nft721.address, minterRole, minter);

    // console.log("TestMockNFT721 grantRole[MINTER_ROLE] after:", minter, await nft721.hasRole(minterRole, minter));
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
    await coreskyHub.connect(operator).setFee(100);
    console.log("CoreskyHub set Before project FeeTo:", await coreskyHub.feeTo(), await coreskyHub.fee());
  });

  it("Allocation-launchpad", async function () {
    const { admin, operator } = await signer();
    /**
         function launchpad(
          uint256 _roundID, 
          address _target, 
          address payable _receipt, 
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
    _receipt = launchpad.address;
    let _payment = erc20token.address;
    let _nftPrice = 2000;
    let now = parseInt(new Date().getTime() / 1000);
    let _startTime = now - 60;
    let _endTime = now + 3600;
    let _voteEndTime = _endTime + 60;
    let _mintEndTime = _voteEndTime + 60;
    console.log(
      "launchpad param:",
      _roundID,
      _target,
      _receipt,
      _payment,
      _nftPrice,
      _startTime,
      _endTime,
      _voteEndTime,
      _mintEndTime
    );
    await launchpad
      .connect(operator)
      .launchpad(
        _roundID,
        _target,
        _receipt,
        _payment,
        _nftPrice,
        _startTime,
        _endTime,
        _voteEndTime,
        _mintEndTime
      );

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
    
  });

  it("preSale", async function () {
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
    let preSaleNum = 1;
    let voteNum = 1;
   
    let owner = user.address;
    let _price = 2000 * preSaleNum;
    // get allowance
    let allowaceBefore = await erc20token.allowance(owner, launchpad.address);
    // approve
    await erc20token.connect(user).approve(launchpad.address, _price);
    // get allowance
    let allowaceAfter = await erc20token.allowance(owner, launchpad.address);
    console.log(
      "preSale param:",
      roundID,
      preSaleID,
      preSaleNum,
      owner,
      "allowace:",
      allowaceBefore,
      allowaceAfter
    );

   
   let tx = await launchpad
      .connect(user)
      .preSale(roundID, preSaleID, preSaleNum, voteNum, {
        from: owner,
        value: 0,
      });
      presaleUsers.push({ roundID, preSaleID, preSaleNum, voteNum });
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

  it("setTotalQuantity", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function setTotalQuantity(
      uint256 _roundID, 
      uint256 _totalQuantity) external onlyRole(OPERATOR_ROLE) {
 */

    let roundID = lpid;
    // function getTotalQuantity(uint256 _roundID) 
    console.log("TotalQuantity Before:",await launchpad.getTotalQuantity(roundID));

    // function isAllowOversold(uint256 _roundID)
    console.log("isAllowOversold Before:",await launchpad.isAllowOversold(roundID));
    let _totalQuantity = 20;
    let tx = await launchpad.connect(operator).setTotalQuantity(roundID, _totalQuantity, {
      from: operator.address,
      value: 0,
    });

    // console.log("TotalQuantity ret:", await tx.wait());

    // function getTotalQuantity(uint256 _roundID) 
    console.log("TotalQuantity After:",await launchpad.getTotalQuantity(roundID));

    // function isAllowOversold(uint256 _roundID)
    console.log("isAllowOversold After:",await launchpad.isAllowOversold(roundID));

    // function getProjectTotalSales(uint256 _roundID)
      console.log("getProjectTotalSales:",await launchpad.getProjectTotalSales(roundID));
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
    // get allowance
    let allowaceBefore = await erc20token.allowance(owner, launchpad.address);
    // approve
    await erc20token.connect(user).approve(launchpad.address, _price);
    // get allowance
    let allowaceAfter = await erc20token.allowance(owner, launchpad.address);
    console.log(
      "preSale-limitPreSale param:",
      roundID,
      preSaleID,
      preSaleNum,
      owner,
      "allowace:",
      allowaceBefore,
      allowaceAfter
    );
   let tx = launchpad
      .connect(user)
      .preSale(roundID, preSaleID, preSaleNum, voteNum, {
        from: owner,
        value: 0,
      });

      await (0, chai.expect)(tx).to.be.revertedWith("The LaunchPad activity has sold out");

    // let getPreSaleLog = await launchpad.getPreSaleLog(roundID); 
    // console.log("getPreSaleLog:", getPreSaleLog);
  });

  it("pause-launchpad", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function pause(uint256 _roundID) public whenNotPaused(_roundID) onlyRole(OPERATOR_ROLE) 
 */

    let roundID = lpid;
    // function paused(uint256 _roundID) 
    console.log("pause Before:",await launchpad.paused(roundID));

    let tx = await launchpad.connect(operator).pause(roundID, {
      from: operator.address,
      value: 0,
    });

    // console.log("pause ret:", await tx.wait());

    // function paused(uint256 _roundID) 
    console.log("pause After:",await launchpad.paused(roundID));
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
    let preSaleID = parseInt(new Date().getTime() / 1000) + 2;
    // limit
    // let preSaleNum = 20;
    let preSaleNum = 2;
    let voteNum = 1;
   
    let owner = user.address;
    let _price = 2000 * preSaleNum;
    // get allowance
    let allowaceBefore = await erc20token.allowance(owner, launchpad.address);
    // approve
    await erc20token.connect(user).approve(launchpad.address, 0);
    await erc20token.connect(user).approve(launchpad.address, _price);
    // get allowance
    let allowaceAfter = await erc20token.allowance(owner, launchpad.address);
    console.log(
      "paused-PreSale param:",
      roundID,
      preSaleID,
      preSaleNum,
      owner,
      "allowace:",
      allowaceBefore,
      allowaceAfter
    );
   let tx = launchpad
      .connect(user)
      .preSale(roundID, preSaleID, preSaleNum, voteNum, {
        from: owner,
        value: 0,
      });

      await (0, chai.expect)(tx).to.be.revertedWith("Pausable: paused");
  });

  it("unpause-launchpad", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function unpause(uint256 _roundID) public whenNotPaused(_roundID) onlyRole(OPERATOR_ROLE) 
 */

    let roundID = lpid;
    // function paused(uint256 _roundID) 
    console.log("unpause Before:",await launchpad.paused(roundID));

    let tx = await launchpad.connect(operator).unpause(roundID, {
      from: operator.address,
      value: 0,
    });

    // console.log("unpause ret:", await tx.wait());

    // function paused(uint256 _roundID) 
    console.log("unpause After:",await launchpad.paused(roundID));
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
    let preSaleID = parseInt(new Date().getTime() / 1000) + 3;
    // limit
    // let preSaleNum = 20;
    let preSaleNum = 9;
    let voteNum = 1;
   
    let owner = user.address;
    let _price = 2000 * preSaleNum;
    // get allowance
    let allowaceBefore = await erc20token.allowance(owner, launchpad.address);
    // approve
    await erc20token.connect(user).approve(launchpad.address, 0);
    await erc20token.connect(user).approve(launchpad.address, _price);
    // get allowance
    let allowaceAfter = await erc20token.allowance(owner, launchpad.address);
    console.log(
      "unpause-PreSale param:",
      roundID,
      preSaleID,
      preSaleNum,
      owner,
      "allowace:",
      allowaceBefore,
      allowaceAfter
    );
   let tx = await launchpad
      .connect(user)
      .preSale(roundID, preSaleID, preSaleNum, voteNum, {
        from: owner,
        value: 0,
      });

      presaleUsers.push({ roundID, preSaleID, preSaleNum, voteNum });

    // let data = await tx.wait();
    // console.log("tx:", data);

    let getPreSaleLog = await launchpad.getPreSaleLog(roundID); 
    console.log("getPreSaleLog:", getPreSaleLog);

    console.log("getTotalQuantity:", await launchpad.getTotalQuantity(roundID));
    console.log("getProjectTotalSales:", await launchpad.getProjectTotalSales(roundID));
        // Returns project SoldOut status by the roundID.
        // function isSoldOut(uint256 _roundID) external view returns (bool)
        console.log("isSoldOut:", await launchpad.isSoldOut(roundID));
        console.log("getLpStatus:", await launchpad.getLpStatus(roundID));
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
    let preSaleID = parseInt(new Date().getTime() / 1000) + 4;
    // limit
    let preSaleNum = 20;
    // let preSaleNum = 1;
    let voteNum = 1;
   
    let owner = user.address;
    let _price = 2000 * preSaleNum;
    // get allowance
    let allowaceBefore = await erc20token.allowance(owner, launchpad.address);
    // approve
    await erc20token.connect(user).approve(launchpad.address, 0);
    await erc20token.connect(user).approve(launchpad.address, _price);
    // get allowance
    let allowaceAfter = await erc20token.allowance(owner, launchpad.address);
    console.log(
      "SoldOut-PreSale param:",
      roundID,
      preSaleID,
      preSaleNum,
      owner,
      "allowace:",
      allowaceBefore,
      allowaceAfter
    );
   let tx = launchpad
      .connect(user)
      .preSale(roundID, preSaleID, preSaleNum, voteNum,{
        from: owner,
        value: 0,
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

  it("coreskyHub-refundFundraisingVote-user", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    let roundID = presaleUsers[0].roundID;
    ////////////////////////////////
    let nonce = parseInt(await coreskyHub.connect(operator).nonce());
    console.log("nonce:", nonce);
    let now = parseInt(new Date().getTime() / 1000);
    let deadline = now + 5 * 60;
    let serialNo = presaleUsers[0].preSaleID;

    let voteCount = await launchpad.getVoteNum(roundID, user.address);

    console.log("user vote count:", voteCount);
    let message = {
      roundID: roundID,
      serialNo,
      voteAddr: launchpad.address,
      voteCount,
      nonce,
      deadline,
    };
    let signature = await walletSign(user, "refundFundraisingVote",coreskyHub.address, message);

 
    /**
    function refundFundraisingVote(Types.EIP712Signature calldata signature, uint256 roundID, uint256 serialNo) 
             */
    let tx = coreskyHub.connect(user).refundFundraisingVote(signature, roundID, serialNo);

    await (0, chai.expect)(tx).to.be.revertedWith("Fundraising Vote has not started");

    // 设置预售结束时间-已结束
    await coreskyHub.connect(operator).setEndTime(roundID, parseInt(new Date().getTime() / 1000) - 20);
    // 设置二次投票时间已结束=Mint开始
    await coreskyHub.connect(operator).setVoteEndTime(roundID, parseInt(new Date().getTime() / 1000) - 20);

    tx = coreskyHub.connect(user).refundFundraisingVote(signature, roundID, serialNo);

    await (0, chai.expect)(tx).to.be.revertedWith("Fundraising Vote has ended");

    // 设置二次投票时间-进行中
    await coreskyHub.connect(operator).setVoteEndTime(roundID, parseInt(new Date().getTime() / 1000) + 20000);

    await coreskyHub.connect(user).refundFundraisingVote(signature, roundID, serialNo);
    // 设置Mint结束时间
    // await coreskyHub.connect(operator).setMintEndTime(roundID,  parseInt(new Date().getTime() / 1000) + 300);

    let vote = await launchpad.getProjectVote(roundID);
    console.log("getProjectVote: voteCount", n(vote[0]), "totalVote", n(vote[1]), "voteRatio", n(vote[2]));
  });


  it("coreskyHub-refundFundraisingVote-【fundraisingStatus=2】-fail-【presaleRefund】", async function () {
    const { admin, operator, bob, sam, user, signBot } = await signer();
    let roundID = lpid;
    let vote = await launchpad.getProjectVote(roundID);
    console.log("getProjectVote: voteCount", n(vote[0]), "totalVote", n(vote[1]), "voteRatio", n(vote[2]));
    // 设置二次投票时间-进行中
    await coreskyHub.connect(signBot).presaleRefund(roundID);
  });

  it("coreskyHub-setVoteEndTime-operator", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    // 设置二次投票时间已结束=Mint开始
    await coreskyHub.connect(operator).setVoteEndTime(lpid, 0);
    console.log("===================set mint end time = 0 ========================");
  });

  it("coreskyHub-setMintEndTime-operator", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    // 设置Mint结束时间
    await coreskyHub.connect(operator).setMintEndTime(lpid, 0);
    console.log("===================set mint end time = 0 ========================");
 
  });

  it("coreskyHub-apNftMint", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    // presaleUsers.push({ roundID, preSaleID, preSaleNum, voteNum });

    ////////////////////////////////
    let nonce = parseInt(await coreskyHub.connect(user).nonce());
    let now = parseInt(new Date().getTime() / 1000);
    let deadline = now + 5 * 60;
    let preSaleIDs = [];
    let totalPreSaleNum = 0;
    let roundID;
    for(let i =0;i< presaleUsers.length;i++){

      roundID = presaleUsers[i].roundID;
      let preSaleID = presaleUsers[i].preSaleID
      let preSaleNum = presaleUsers[i].preSaleNum
      totalPreSaleNum += preSaleNum;
      preSaleIDs.push(preSaleID);
 
       // preSaleNum = await launchpad.getPreSaleNum(user.address, preSaleID);     
    }
     
    let message = {
      roundID,
      // preSaleIDs: preSaleIDs,
      allocationAddr: launchpad.address,
      mintNum: totalPreSaleNum,
      nonce,
      deadline,
    };

    console.log("message:", message);
    let signature = await walletSign(user, "apNftMint",coreskyHub.address, message);
    tx = await coreskyHub.connect(user).apNftMint(signature, roundID);


  });

  it("coreskyHub-depositIssueToken", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    let roundID = lpid;
    let _issueToken = issueToken.address;
    // 每nft发100代币
    const nftContainNum = 100_0000000000;
    const preSalesNum = await launchpad.getProjectTotalSales(roundID);

    let _price = nftContainNum * preSalesNum;
    let owner = bob.address;
    let now = parseInt(new Date().getTime() / 1000);
    let deadline = now + 5 * 60;
    let serialNo = now
    
    // get allowance
    let allowaceBefore = await issueToken.allowance(owner, airdrops.address);
    // approve
    await issueToken.connect(bob).approve(airdrops.address, _price);
    // get allowance
    let allowaceAfter = await issueToken.allowance(owner, airdrops.address);
    console.log("depositIssueToken param:", roundID, _issueToken, nftContainNum, owner, "allowace:", allowaceBefore, allowaceAfter);
      
    // 项目方存入发行token
    console.log("depositIssueToken Before: ", await airdrops.getWithdrawableAmount(issueToken.address));
    /**
    function deposit(uint256 serialNo, address token, uint256 amount, uint256 deadline, bytes memory signature)
     */
    let signature =  await signDeposit(serialNo, _issueToken, _price, deadline);
      
    await airdrops.connect(bob).deposit(serialNo, _issueToken, _price, deadline, signature);
    console.log("depositIssueToken After: ", await airdrops.getWithdrawableAmount(issueToken.address));
    
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
  });

  console.log("====================================apNftVesting=========================================");
  let apNftVesting;
  it("depoly-apNftVesting", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    let receivedAddress = admin.address;
    // _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    // _setupRole(MINTER_ROLE, _msgSender());
    const TestApNftVesting = await ethers.getContractFactory("ApNftVesting");

    /**
     *  address admin,
        address receivedAddress
     */

    apNftVesting = await TestApNftVesting.deploy(admin.address, receivedAddress);
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


  it("Coresky-getAlloctionInfo", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    const info = await launchpad.getAlloctionInfo(lpid);

    
    console.log("Coresky-AlloctionInfo:",info);
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

});