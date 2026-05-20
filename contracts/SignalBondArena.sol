// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

contract SignalBondArena {
    struct Signal {
        uint256 id;
        string externalSignalId;
        string marketId;
        address agent;
        string agentName;
        bool sideYes;
        uint16 marketPriceBps;
        uint16 agentProbabilityBps;
        uint16 confidenceBps;
        uint16 edgeBps;
        uint256 stakeMicroUsdc;
        bytes32 modelHash;
        bytes32 dataHash;
        uint64 committedAt;
        bool resolved;
        bool outcomeCorrect;
    }

    IERC20 public immutable usdc;
    address public owner;
    address public treasury;
    uint256 public signalCount;
    mapping(uint256 => Signal) public signals;

    event SignalCommitted(
        uint256 indexed signalRecordId,
        string externalSignalId,
        string marketId,
        address indexed agent,
        string agentName,
        bool sideYes,
        uint16 marketPriceBps,
        uint16 agentProbabilityBps,
        uint16 confidenceBps,
        uint16 edgeBps,
        uint256 stakeMicroUsdc,
        bytes32 modelHash,
        bytes32 dataHash
    );

    event SignalResolved(
        uint256 indexed signalRecordId,
        bool outcomeCorrect,
        address indexed recipient,
        uint256 stakeMicroUsdc
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    constructor(address usdcAddress, address treasuryAddress) {
        require(usdcAddress != address(0), "usdc required");
        require(treasuryAddress != address(0), "treasury required");

        usdc = IERC20(usdcAddress);
        owner = msg.sender;
        treasury = treasuryAddress;
    }

    function commitSignal(
        string calldata externalSignalId,
        string calldata marketId,
        string calldata agentName,
        bool sideYes,
        uint16 marketPriceBps,
        uint16 agentProbabilityBps,
        uint16 confidenceBps,
        uint16 edgeBps,
        uint256 stakeMicroUsdc,
        bytes32 modelHash,
        bytes32 dataHash
    ) external returns (uint256 signalRecordId) {
        require(bytes(externalSignalId).length > 0, "signal required");
        require(bytes(marketId).length > 0, "market required");
        require(bytes(agentName).length > 0, "agent required");
        require(stakeMicroUsdc > 0, "stake required");
        require(marketPriceBps <= 10_000, "market price invalid");
        require(agentProbabilityBps <= 10_000, "agent probability invalid");
        require(confidenceBps <= 10_000, "confidence invalid");
        require(edgeBps <= 10_000, "edge invalid");

        bool transferred = usdc.transferFrom(msg.sender, address(this), stakeMicroUsdc);
        require(transferred, "transfer failed");

        signalRecordId = ++signalCount;
        signals[signalRecordId] = Signal({
            id: signalRecordId,
            externalSignalId: externalSignalId,
            marketId: marketId,
            agent: msg.sender,
            agentName: agentName,
            sideYes: sideYes,
            marketPriceBps: marketPriceBps,
            agentProbabilityBps: agentProbabilityBps,
            confidenceBps: confidenceBps,
            edgeBps: edgeBps,
            stakeMicroUsdc: stakeMicroUsdc,
            modelHash: modelHash,
            dataHash: dataHash,
            committedAt: uint64(block.timestamp),
            resolved: false,
            outcomeCorrect: false
        });

        emit SignalCommitted(
            signalRecordId,
            externalSignalId,
            marketId,
            msg.sender,
            agentName,
            sideYes,
            marketPriceBps,
            agentProbabilityBps,
            confidenceBps,
            edgeBps,
            stakeMicroUsdc,
            modelHash,
            dataHash
        );
    }

    function resolveSignal(uint256 signalRecordId, bool outcomeCorrect) external onlyOwner {
        _resolveSignal(signalRecordId, outcomeCorrect);
    }

    function resolveSignalsBulk(
        uint256[] calldata signalRecordIds,
        bool[] calldata outcomeCorrectValues
    ) external onlyOwner {
        require(signalRecordIds.length == outcomeCorrectValues.length, "length mismatch");

        for (uint256 index = 0; index < signalRecordIds.length; index++) {
            _resolveSignal(signalRecordIds[index], outcomeCorrectValues[index]);
        }
    }

    function _resolveSignal(uint256 signalRecordId, bool outcomeCorrect) internal {
        Signal storage signal = signals[signalRecordId];
        require(signal.agent != address(0), "unknown signal");
        require(!signal.resolved, "already resolved");

        signal.resolved = true;
        signal.outcomeCorrect = outcomeCorrect;

        address recipient = outcomeCorrect ? signal.agent : treasury;
        bool transferred = usdc.transfer(recipient, signal.stakeMicroUsdc);
        require(transferred, "resolve transfer failed");

        emit SignalResolved(signalRecordId, outcomeCorrect, recipient, signal.stakeMicroUsdc);
    }
}
