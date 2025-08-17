const express = require('express');
const path = require('path');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Fluent Testnet Configuration
const FLUENT_RPC = 'https://rpc.testnet.fluent.xyz';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const CONTRACT_ABI = [
    "function submitScore(uint256 _score, string memory _playerName) external",
    "function getLeaderboard() external view returns (tuple(address playerAddress, string playerName, uint256 highScore, uint256 timestamp)[])",
    "function getPlayerHighScore(address _player) external view returns (uint256)",
    "event NewHighScore(address indexed player, string playerName, uint256 score)"
];

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(FLUENT_RPC);

// API Routes
app.get('/api/leaderboard', async (req, res) => {
    try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const leaderboard = await contract.getLeaderboard();
        
        const formattedLeaderboard = leaderboard.map((player, index) => ({
            rank: index + 1,
            address: player.playerAddress,
            name: player.playerName,
            score: player.highScore.toNumber(),
            timestamp: player.timestamp.toNumber()
        }));

        res.json({ success: true, leaderboard: formattedLeaderboard });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/player/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const highScore = await contract.getPlayerHighScore(address);
        
        res.json({ 
            success: true, 
            highScore: highScore.toNumber() 
        });
    } catch (error) {
        console.error('Error fetching player score:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve the game
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Flappy Bird server running on port ${PORT}`);
    console.log(`Connected to Fluent Testnet: ${FLUENT_RPC}`);
});
