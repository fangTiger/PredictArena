// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract SignalBondVault {
    struct Commitment {
        uint256 id;
        string signalId;
        string marketId;
        address committer;
        bool buyYes;
        uint16 confidenceBps;
        uint256 bondAmount;
        bytes32 commitmentHash;
        uint64 committedAt;
        bool refunded;
    }

    IERC20 public immutable usdc;
    uint64 public immutable refundDelaySeconds;
    uint256 public nextCommitmentId = 1;

    mapping(uint256 => Commitment) public commitments;
    mapping(bytes32 => bool) public committedSignalIds;

    event SignalCommitted(
        uint256 indexed commitmentId,
        string signalId,
        string marketId,
        address indexed committer,
        bool buyYes,
        uint16 confidenceBps,
        uint256 bondAmount,
        bytes32 commitmentHash
    );

    event SignalRefunded(uint256 indexed commitmentId, address indexed committer);

    constructor(address usdcAddress, uint64 refundDelay) {
        require(usdcAddress != address(0), "usdc required");
        usdc = IERC20(usdcAddress);
        refundDelaySeconds = refundDelay;
    }

    function commitSignal(
        string calldata signalId,
        string calldata marketId,
        bool buyYes,
        uint16 confidenceBps,
        uint256 bondAmount,
        bytes32 commitmentHash
    ) external returns (uint256 commitmentId) {
        require(bytes(signalId).length > 0, "signal required");
        require(bytes(marketId).length > 0, "market required");
        require(bondAmount > 0, "bond required");
        require(confidenceBps <= 10_000, "confidence invalid");

        bytes32 signalKey = keccak256(bytes(signalId));
        require(!committedSignalIds[signalKey], "signal already committed");
        committedSignalIds[signalKey] = true;

        bool transferred = usdc.transferFrom(msg.sender, address(this), bondAmount);
        require(transferred, "transfer failed");

        commitmentId = nextCommitmentId++;
        commitments[commitmentId] = Commitment({
            id: commitmentId,
            signalId: signalId,
            marketId: marketId,
            committer: msg.sender,
            buyYes: buyYes,
            confidenceBps: confidenceBps,
            bondAmount: bondAmount,
            commitmentHash: commitmentHash,
            committedAt: uint64(block.timestamp),
            refunded: false
        });

        emit SignalCommitted(
            commitmentId,
            signalId,
            marketId,
            msg.sender,
            buyYes,
            confidenceBps,
            bondAmount,
            commitmentHash
        );
    }

    function refund(uint256 commitmentId) external {
        Commitment storage commitment = commitments[commitmentId];
        require(commitment.committer != address(0), "unknown commitment");
        require(msg.sender == commitment.committer, "only committer");
        require(!commitment.refunded, "already refunded");
        require(block.timestamp >= commitment.committedAt + refundDelaySeconds, "refund locked");

        commitment.refunded = true;

        bool transferred = usdc.transfer(msg.sender, commitment.bondAmount);
        require(transferred, "refund failed");

        emit SignalRefunded(commitmentId, msg.sender);
    }
}
