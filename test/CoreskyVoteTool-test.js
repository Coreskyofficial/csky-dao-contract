const {
  deploy,
  gasCalculate,
  getDeployed,
  getDeployedInstance,
  getAttach,
} = require("./deploy.js");
const {
  mockData,
  makeMerkle,
  mockVIPData,
  makeVIPMerkle,
  mock500Data,
} = require("./merkle/merkle.js");
const { getJson } = require("./json.js");
const chai = require("chai");

const { ethers } = require('hardhat');

const {
  encrypt,
  recoverPersonalSignature,
  recoverTypedSignatureLegacy,
  signTypedDataLegacy,
  recoverTypedSignature,
  recoverTypedSignature_v4,
} = require('eth-sig-util');

const { BigNumber, utils, provider } = ethers;
const { zeroAddress,bufferToHex, keccakFromString,privateToAddress, ecsign } = require("ethereumjs-util");
// const { BigNumber, utils } = require("ethers");
const {structHash, signHash, signTypedData} = require("./signCoreskyHub.js");
const {
  hexStripZeros,
  solidityPack,
  concat,
  toUtf8Bytes,
  keccak256,
  SigningKey,
  formatBytes32String,
  joinSignature,
  splitSignature,
} = utils;

async function signer() {
  const [admin, operator, bob, sam, user, user2] = await ethers.getSigners();
  return { admin, operator, bob, sam, user, user2 };
}

describe("CoreskyVoteTool-test", function () {
  let lpid = 256;
  let lpid2 = 100;
  let accounts;
  let metaTxLib;
  let coreskyHub;
  let voteTool;
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
    const { admin, operator } = await signer();

    let mocker = accounts[0].address;

    let minter = accounts[1].address;

    let user = accounts[4].address;
    let user2 = accounts[5].address;

    const TestMetaTxLib = await ethers.getContractFactory("MetaTxLib");
    metaTxLib = await TestMetaTxLib.deploy();
    await metaTxLib.deployed();

    const TestVoteTool = await ethers.getContractFactory("VoteTool", {
      libraries: {
        MetaTxLib: metaTxLib.address,
        // Types: _types.address
      }
    });

    // const TetherToken = await ethers.getContractFactory("TetherToken");

    // // TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals)
    // erc20token = await TetherToken.deploy(
    //   "10000000000000000",
    //   "USD",
    //   "USDT",
    //   6
    // );
    // await erc20token.deployed();
    // let totalSupply = await erc20token.totalSupply();

    // console.log("USDT:", erc20token.address, "totalSupply:", totalSupply);
    // console.log(
    //   "admin Balance:",
    //   admin.address,
    //   await erc20token.balances(admin.address)
    // );

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");

    // constructor() payable ERC20("ERC20Mock", "ERC20Mock")
    erc20token = await ERC20Mock.deploy();
    await erc20token.deployed();
    let totalSupply = await erc20token.totalSupply();

    console.log("ERC20Mock:", erc20token.address, "totalSupply:", totalSupply);
    console.log(
      "admin Balance:",
      admin.address,
      await erc20token.balanceOf(admin.address)
    );
    // 为账号0x51A41BA1Ce3A6Ac0135aE48D6B92BEd32E075fF0 转移10000
    await erc20token.transfer(user, m(10000000));
    console.log("user Balance:", user, await erc20token.balanceOf(user));


    await erc20token.transfer(user2, m(10000000));
    console.log("user2 Balance:", user2, await erc20token.balanceOf(user2));
    /**
     * constructor(address root, address creator) {
        _setupRole(DEFAULT_ADMIN_ROLE, root);
        _grantRole(CREATE_ROLE, creator);
    }
     */
    voteTool = await TestVoteTool.deploy(
      admin.address,
      operator.address
    );
    await voteTool.deployed();

  });

  it("metaTxLib-verify", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    /**
    function applyProjectVote(
      uint256 _roundID, 
      uint256 _totalQuantity) external onlyRole(OPERATOR_ROLE) {
 */

        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log('chainId = ', network.chainId);
        console.log("MetaTxLib", metaTxLib.address)
    
        
        // Get test privatekey
        // const privateKey = keccakFromString('cow');
        // const targetAddress = "0x" + privateToAddress(privateKey).toString('hex');
    
        let nonce = parseInt(await voteTool.connect(sam).nonce()) ;
        let now = parseInt(new Date().getTime() / 1000);
        let deadline = now + 5*60;
        let serialNo = now;
    
        let supportCount = 50;
        let opposeCount = 10;
        let voteRatio = supportCount * 100 / (supportCount + opposeCount);
        voteRatio = parseInt(voteRatio);
    
        let expireTime = now + 10*60;
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
        let projectVote ={
          serialNo,
          projectAddr: sam.address,
          supportCount,
          opposeCount,
          voteRatio,
          expireTime
        }
    
        let message = {
          ...projectVote,
          nonce,
          deadline,
        }
        
        let verifyContract = metaTxLib.address;
        // let messageHash = structHash("applyProjectVote", message);
    
        // let hashedMessage = signHash(messageHash, chainId, verifyContract);

        let msgParams = signTypedData(chainId, verifyContract,"addProposal", message);
    
        console.log("==>>msgParams", msgParams);
        const sign = await sam._signTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message
        );
        
        console.log(`signature = `, sign);
        // 如果是metmask插件，可以调用下面的方法
        // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);
    
        const jsRecoveredAddr = utils.verifyTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message,
          sign
        );
        // const jsRecoveredAddr = recoverTypedSignature({
        //   data: msgParams,
        //   sig: signature,
        // });

        // const sig = await provider.send('personal_sign', [
        //   hashedMessage,
        //   sam.address,
        // ]);
        // console.log(`signature = `, sig);
    
        // const jsRecoveredAddr = recoverPersonalSignature({
        //   data: hashedMessage,
        //   sig: sig,
        // });
        // console.log('jsRecoveredAddr = ', jsRecoveredAddr);
        
        chai.expect(await sam.address.toUpperCase()).to.equal(
          jsRecoveredAddr.toUpperCase()
        );

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
      const _sign=  splitSignature(sign);
      let signature = {
           signer: sam.address,
           v: _sign.v,
           r: _sign.r,
           s: _sign.s,
           deadline
        }
    
    console.log("eip712Contract.verify:", signature, projectVote)
        let tx = await metaTxLib.verify(
              signature.signer,
              signature.v,
              signature.r,
              signature.s,
              signature.deadline,
              serialNo,
              sam.address,
              supportCount,
              opposeCount,
              voteRatio,
              expireTime
            );
    
            console.log(tx)
            console.log("======================================")

         
  });

  it("VoteTool-addProposal-bob-【success】", async function () {
    const { admin, operator, bob, sam, user } = await signer();
    
    let project = bob;
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log('chainId = ', network.chainId);
        console.log("MetaTxLib", metaTxLib.address)
    
        
        // Get test privatekey
        // const privateKey = keccakFromString('cow');
        // const targetAddress = "0x" + privateToAddress(privateKey).toString('hex');
    
        let nonce = parseInt(await voteTool.connect(bob).nonce()) ;
        let now = parseInt(new Date().getTime() / 1000);
        let deadline = now + 5*60;
        let serialNo = "100001";
    
        let supportCount = 0;
        let opposeCount = 0;
        let voteRatio = 0;
        let expireTime = now + 10*60;
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
        let projectVote ={
          serialNo,
          projectAddr: zeroAddress(),
          supportCount,
          opposeCount,
          voteRatio,
          expireTime,
          amount: 0
        }
    
        let message = {
          ...projectVote,
          nonce,
          deadline,
        }
        
        let verifyContract = voteTool.address;
        // let messageHash = structHash("addProposal", message);
    
        // let hashedMessage = signHash(messageHash, chainId, verifyContract);

        let msgParams = signTypedData(chainId, verifyContract,"addProposal", message);
    
        console.log("==>>msgParams", msgParams);
        const sign = await project._signTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message
        );
        
        console.log(`signature = `, sign);
        // 如果是metmask插件，可以调用下面的方法
        // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);
    
        const jsRecoveredAddr = utils.verifyTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message,
          sign
        );
        // const jsRecoveredAddr = recoverTypedSignature({
        //   data: msgParams,
        //   sig: signature,
        // });

        // const sig = await provider.send('personal_sign', [
        //   hashedMessage,
        //   project.address,
        // ]);
        // console.log(`signature = `, sig);
    
        // const jsRecoveredAddr = recoverPersonalSignature({
        //   data: hashedMessage,
        //   sig: sig,
        // });
        // console.log('jsRecoveredAddr = ', jsRecoveredAddr);
        
        chai.expect(await project.address.toUpperCase()).to.equal(
          jsRecoveredAddr.toUpperCase()
        );

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
      const _sign=  splitSignature(sign);
      let signature = {
           signer: project.address,
           v: _sign.v,
           r: _sign.r,
           s: _sign.s,
           deadline
        }
            /**
             *  function applyProjectVote(
        Types.EIP712Signature calldata signature,
        Types.ProjectVote calldata projectVote)
             */
        await voteTool.connect(project).addProposal(signature, projectVote.serialNo, projectVote.expireTime );


        let tx= voteTool.connect(project).addProposal(signature, projectVote.serialNo, projectVote.expireTime );

        await (0, chai.expect)(tx).to.be.revertedWith("proposal exists");

        console.log("voteTool.getProposal", await voteTool.getProposal(projectVote.serialNo));

  });

  it("VoteTool-voteSupport-user-【payType=none】", async function () {
    const { admin, operator, bob, sam, user } = await signer();

        let _signer = user;
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log('chainId = ', network.chainId);
        console.log("MetaTxLib", metaTxLib.address)
    
        ////////////////////////////////
        let nonce = parseInt(await voteTool.connect(_signer).nonce()) ;
        let now = parseInt(new Date().getTime() / 1000);
        let deadline = now + 5*60;
        let serialNo = "100001";
    
        let voteCount = "10";

    
        let message = {
          serialNo,
          voteAddr: _signer.address,
          voteCount,
          nonce,
          deadline,
        }
        
        let verifyContract = voteTool.address;
        let msgParams = signTypedData(chainId, verifyContract,"voteSupport", message);
    
        console.log("==>>msgParams", msgParams);
        const sign = await _signer._signTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message
        );
        
        console.log(`signature = `, sign);
        // 如果是metmask插件，可以调用下面的方法
        // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);
    
        const jsRecoveredAddr = utils.verifyTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message,
          sign
        );
        
        chai.expect(await _signer.address.toUpperCase()).to.equal(
          jsRecoveredAddr.toUpperCase()
        );

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
      const _sign=  splitSignature(sign);
      let signature = {
           signer: _signer.address,
           v: _sign.v,
           r: _sign.r,
           s: _sign.s,
           deadline
        }
            /**
    function voteSupport(
        Types.EIP712Signature calldata signature,
        uint256 _serialNo,
        uint256 _voteCount) public payable
             */
        await voteTool.connect(_signer).voteSupport(signature, serialNo, voteCount, {
          value: 0,
        });


        // let tx= voteTool.connect(project).addProposal(signature, projectVote.serialNo, projectVote.expireTime );

        // await (0, chai.expect)(tx).to.be.revertedWith("proposal exists");

        console.log("voteTool.getProposal", await voteTool.getProposal(serialNo));

  });

  it("VoteTool-voteOppose-user-【payType=none】", async function () {
    const { admin, operator, bob, sam, user2 } = await signer();

        let _signer = user2;
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log('chainId = ', network.chainId);
        console.log("MetaTxLib", metaTxLib.address)
    
        ////////////////////////////////
        let nonce = parseInt(await voteTool.connect(_signer).nonce()) ;
        let now = parseInt(new Date().getTime() / 1000);
        let deadline = now + 5*60;
        let serialNo = "100001";
    
        let voteCount = 5;

    
        let message = {
          serialNo,
          voteAddr: _signer.address,
          voteCount,
          nonce,
          deadline,
        }
        
        let verifyContract = voteTool.address;
        let msgParams = signTypedData(chainId, verifyContract,"voteOppose", message);
    
        console.log("==>>msgParams", msgParams);
        const sign = await _signer._signTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message
        );
        
        console.log(`signature = `, sign);
        // 如果是metmask插件，可以调用下面的方法
        // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);
    
        const jsRecoveredAddr = utils.verifyTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message,
          sign
        );
        
        chai.expect(await _signer.address.toUpperCase()).to.equal(
          jsRecoveredAddr.toUpperCase()
        );

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
      const _sign=  splitSignature(sign);
      let signature = {
           signer: _signer.address,
           v: _sign.v,
           r: _sign.r,
           s: _sign.s,
           deadline
        }
            /**
    function voteOppose(
        Types.EIP712Signature calldata signature,
        uint256 _serialNo,
        uint256 _voteCount) public payable
             */
        await voteTool.connect(_signer).voteOppose(signature, serialNo, voteCount, {
          value: 0,
        });


        // let tx= voteTool.connect(project).addProposal(signature, projectVote.serialNo, projectVote.expireTime );

        // await (0, chai.expect)(tx).to.be.revertedWith("proposal exists");

        console.log("voteTool.getProposal", await voteTool.getProposal(serialNo));

  });

  it("VoteTool-setPayType-【payType=Native】", async function () {
    const { admin, operator, bob, sam, user2 } = await signer();
            /**
    function setPayType(address token, uint8 payType) 
    enum PayType {
        None,  // 0
        Native,// 1
        Token  // 2
    }
             */
        let token = zeroAddress();
        await voteTool.connect(operator).setPayType(token,1);

        console.log("voteTool.pay", await voteTool.pay());

  });

  it("VoteTool-voteSupport-user-【payType=Native】", async function () {
    const { admin, operator, bob, sam, user } = await signer();

        let _signer = user;
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log('chainId = ', network.chainId);
        console.log("MetaTxLib", metaTxLib.address)
    
        ////////////////////////////////
        let nonce = parseInt(await voteTool.connect(_signer).nonce());
        let now = parseInt(new Date().getTime() / 1000);
        let deadline = now + 5*60;
        let serialNo = "100001";
    
        let voteCount = "10";

    
        let message = {
          serialNo,
          voteAddr: _signer.address,
          voteCount,
          nonce,
          deadline,
        }
        
        let verifyContract = voteTool.address;
        let msgParams = signTypedData(chainId, verifyContract,"voteSupport", message);
    
        console.log("==>>msgParams", msgParams);
        const sign = await _signer._signTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message
        );
        
        console.log(`signature = `, sign);
        // 如果是metmask插件，可以调用下面的方法
        // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);
    
        const jsRecoveredAddr = utils.verifyTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message,
          sign
        );
        
        chai.expect(await _signer.address.toUpperCase()).to.equal(
          jsRecoveredAddr.toUpperCase()
        );

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
      const _sign=  splitSignature(sign);
      let signature = {
           signer: _signer.address,
           v: _sign.v,
           r: _sign.r,
           s: _sign.s,
           deadline
        }

      let amount = await voteTool.getSupportVoteAmount(_signer.address, serialNo, voteCount);
      console.log("voteTool.getSupportVoteAmount", amount);
      /**
    function voteSupport(
        Types.EIP712Signature calldata signature,
        uint256 _serialNo,
        uint256 _voteCount) public payable
             */
        await voteTool.connect(_signer).voteSupport(signature, serialNo, voteCount, {
          value: amount,
        });


        // let tx= voteTool.connect(project).addProposal(signature, projectVote.serialNo, projectVote.expireTime );

        // await (0, chai.expect)(tx).to.be.revertedWith("proposal exists");

        console.log("voteTool.getProposal", await voteTool.getProposal(serialNo));

  });

  it("VoteTool-voteOppose-user-【payType=Native】", async function () {
    const { admin, operator, bob, sam, user2 } = await signer();

        let _signer = user2;
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log('chainId = ', network.chainId);
        console.log("MetaTxLib", metaTxLib.address)
    
        ////////////////////////////////
        let nonce = parseInt(await voteTool.connect(_signer).nonce()) ;
        let now = parseInt(new Date().getTime() / 1000);
        let deadline = now + 5*60;
        let serialNo = "100001";
    
        let voteCount = 5;

    
        let message = {
          serialNo,
          voteAddr: _signer.address,
          voteCount,
          nonce,
          deadline,
        }
        
        let verifyContract = voteTool.address;
        let msgParams = signTypedData(chainId, verifyContract,"voteOppose", message);
    
        console.log("==>>msgParams", msgParams);
        const sign = await _signer._signTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message
        );
        
        console.log(`signature = `, sign);
        // 如果是metmask插件，可以调用下面的方法
        // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);
    
        const jsRecoveredAddr = utils.verifyTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message,
          sign
        );
        
        chai.expect(await _signer.address.toUpperCase()).to.equal(
          jsRecoveredAddr.toUpperCase()
        );

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
      const _sign=  splitSignature(sign);
      let signature = {
           signer: _signer.address,
           v: _sign.v,
           r: _sign.r,
           s: _sign.s,
           deadline
        }

        
      let amount = await voteTool.getOpposeVoteAmount(_signer.address, serialNo, voteCount);
      console.log("voteTool.getOpposeVoteAmount", amount);

            /**
    function voteOppose(
        Types.EIP712Signature calldata signature,
        uint256 _serialNo,
        uint256 _voteCount) public payable
             */
        await voteTool.connect(_signer).voteOppose(signature, serialNo, voteCount, {
          value: amount,
        });


        // let tx= voteTool.connect(project).addProposal(signature, projectVote.serialNo, projectVote.expireTime );

        // await (0, chai.expect)(tx).to.be.revertedWith("proposal exists");

        console.log("voteTool.getProposal", await voteTool.getProposal(serialNo));

  });

  it("VoteTool-setPayType-【payType=Token", async function () {
    const { admin, operator, bob, sam, user2 } = await signer();
            /**
    function setPayType(address token, uint8 payType) 
    enum PayType {
        None,  // 0
        Native,// 1
        Token  // 2
    }
             */
        let token = erc20token.address;
        await voteTool.connect(operator).setPayType(token,2);

        console.log("voteTool.pay", await voteTool.pay());

  });


  it("VoteTool-voteSupport-user-【payType=Token】", async function () {
    const { admin, operator, bob, sam, user } = await signer();

        let _signer = user;
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log('chainId = ', network.chainId);
        console.log("MetaTxLib", metaTxLib.address)
    
        ////////////////////////////////
        let nonce = parseInt(await voteTool.connect(_signer).nonce()) ;
        let now = parseInt(new Date().getTime() / 1000);
        let deadline = now + 5*60;
        let serialNo = "100001";
    
        let voteCount = "10";

    
        let message = {
          serialNo,
          voteAddr: _signer.address,
          voteCount,
          nonce,
          deadline,
        }
        
        let verifyContract = voteTool.address;
        let msgParams = signTypedData(chainId, verifyContract,"voteSupport", message);
    
        console.log("==>>msgParams", msgParams);
        const sign = await _signer._signTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message
        );
        
        console.log(`signature = `, sign);
        // 如果是metmask插件，可以调用下面的方法
        // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);
    
        const jsRecoveredAddr = utils.verifyTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message,
          sign
        );
        
        chai.expect(await _signer.address.toUpperCase()).to.equal(
          jsRecoveredAddr.toUpperCase()
        );

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
      const _sign=  splitSignature(sign);
      let signature = {
           signer: _signer.address,
           v: _sign.v,
           r: _sign.r,
           s: _sign.s,
           deadline
        }

      let amount = await voteTool.getSupportVoteAmount(_signer.address, serialNo, voteCount);
      console.log("voteTool.getSupportVoteAmount", amount);

    // get allowance
    let allowaceBefore = await erc20token.allowance(_signer.address, voteTool.address);
    // approve
    await erc20token.connect(_signer).approve(voteTool.address, amount);
    // get allowance
    let allowaceAfter = await erc20token.allowance(_signer.address, voteTool.address);
    console.log(
      _signer.address,
      "allowace:",
      allowaceBefore,
      allowaceAfter
    );

      /**
    function voteSupport(
        Types.EIP712Signature calldata signature,
        uint256 _serialNo,
        uint256 _voteCount) public payable
             */
        await voteTool.connect(_signer).voteSupport(signature, serialNo, voteCount, {
          value: 0,
        });


        // let tx= voteTool.connect(project).addProposal(signature, projectVote.serialNo, projectVote.expireTime );

        // await (0, chai.expect)(tx).to.be.revertedWith("proposal exists");

        console.log("voteTool.getProposal", await voteTool.getProposal(serialNo));

  });

  it("VoteTool-voteOppose-user-【payType=Token】", async function () {
    const { admin, operator, bob, sam, user2 } = await signer();

        let _signer = user2;
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log('chainId = ', network.chainId);
        console.log("MetaTxLib", metaTxLib.address)
    
        ////////////////////////////////
        let nonce = parseInt(await voteTool.connect(_signer).nonce()) ;
        let now = parseInt(new Date().getTime() / 1000);
        let deadline = now + 5*60;
        let serialNo = "100001";
    
        let voteCount = 5;

    
        let message = {
          serialNo,
          voteAddr: _signer.address,
          voteCount,
          nonce,
          deadline,
        }
        
        let verifyContract = voteTool.address;
        let msgParams = signTypedData(chainId, verifyContract,"voteOppose", message);
    
        console.log("==>>msgParams", msgParams);
        const sign = await _signer._signTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message
        );
        
        console.log(`signature = `, sign);
        // 如果是metmask插件，可以调用下面的方法
        // const signature = await provider.send('eth_signTypedData_v3', [signer.address, msgParams]);
    
        const jsRecoveredAddr = utils.verifyTypedData(
          msgParams.domain,
          msgParams.types,
          msgParams.message,
          sign
        );
        
        chai.expect(await _signer.address.toUpperCase()).to.equal(
          jsRecoveredAddr.toUpperCase()
        );

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
      const _sign=  splitSignature(sign);
      let signature = {
           signer: _signer.address,
           v: _sign.v,
           r: _sign.r,
           s: _sign.s,
           deadline
        }

        
      let amount = await voteTool.getOpposeVoteAmount(_signer.address, serialNo, voteCount);
      console.log("voteTool.getOpposeVoteAmount", amount);

          // get allowance
    let allowaceBefore = await erc20token.allowance(_signer.address, voteTool.address);
    // approve
    await erc20token.connect(_signer).approve(voteTool.address, amount);
    // get allowance
    let allowaceAfter = await erc20token.allowance(_signer.address, voteTool.address);
    console.log(
      _signer.address,
      await erc20token.balanceOf(_signer.address),
      "allowace:",
      allowaceBefore,
      allowaceAfter
    );

            /**
    function voteOppose(
        Types.EIP712Signature calldata signature,
        uint256 _serialNo,
        uint256 _voteCount) public payable
             */
        await voteTool.connect(_signer).voteOppose(signature, serialNo, voteCount, {
          value: 0,
        });


        // let tx= voteTool.connect(project).addProposal(signature, projectVote.serialNo, projectVote.expireTime );

        // await (0, chai.expect)(tx).to.be.revertedWith("proposal exists");

        console.log("voteTool.getProposal", await voteTool.getProposal(serialNo));

  });

  it("VoteTool-grantRole-withdraw", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    let assetRole = await voteTool.ASSET_ROLE();
    await voteTool.grantRole(assetRole, admin.address);

  });
  
  it("VoteTool-withdraw", async function () {
    const { admin, operator, bob, sam, user } = await signer();

    console.log("voteTool thisBalance:",voteTool.address, await voteTool.thisBalance());
    console.log("Before:",operator.address,await operator.getBalance() );
    await voteTool.withdraw(operator.address);
    console.log("After:",operator.address,await operator.getBalance() );
    console.log("voteTool thisBalance:",voteTool.address, await voteTool.thisBalance());

  });

  it("VoteTool-withdrawToken", async function () {
    const { admin, operator, bob, sam, user2 } = await signer();
    console.log(
      "Before:",
      operator.address,
      await erc20token.balanceOf(operator.address)
    );

        await voteTool.withdrawToken(erc20token.address, operator.address);

        console.log(
          "After:",
          operator.address,
          await erc20token.balanceOf(operator.address)
        );
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
