// Game variables
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const gameOverlay = document.getElementById('gameOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreSpan = document.getElementById('finalScore');
const playBtn = document.getElementById('playBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const submitScoreBtn = document.getElementById('submitScore');
const playerNameInput = document.getElementById('playerName');
const connectWalletBtn = document.getElementById('connectWallet');
const walletAddressDiv = document.getElementById('walletAddress');
const leaderboardDiv = document.getElementById('leaderboard');

// Fluent Testnet Configuration
const FLUENT_CHAIN_ID = '0x5222'; // 20994 in hex
const CONTRACT_ADDRESS = ''; // Replace this!
const CONTRACT_ABI = [
    "function submitScore(uint256 _score, string memory _playerName) external",
    "function getLeaderboard() external view returns (tuple(address playerAddress, string playerName, uint256 highScore, uint256 timestamp)[])"
];

// Game state
let gameRunning = false;
let score = 0;
let provider = null;
let signer = null;
let contract = null;
let walletAddress = null;

// Bird properties
const bird = {
    x: 100,
    y: canvas.height / 2,
    velocity: 0,
    gravity: 0.5,
    jump: -8,
    size: 20
};

// Pipe properties
const pipes = [];
const pipeWidth = 60;
const pipeGap = 150;
const pipeSpeed = 3;
let pipeTimer = 0;

// Initialize Web3
async function initWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            // Request account access
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // Check if we're on the correct network
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            
            if (chainId !== FLUENT_CHAIN_ID) {
                // Switch to Fluent Testnet
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: FLUENT_CHAIN_ID }],
                    });
                } catch (switchError) {
                    // This error code indicates that the chain has not been added to MetaMask
                    if (switchError.code === 4902) {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: FLUENT_CHAIN_ID,
                                chainName: 'Fluent Testnet',
                                nativeCurrency: {
                                    name: 'ETH',
                                    symbol: 'ETH',
                                    decimals: 18
                                },
                                rpcUrls: ['https://rpc.testnet.fluent.xyz'],
                                blockExplorerUrls: ['https://testnet.fluentscan.xyz']
                            }],
                        });
                    }
                }
            }
            
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            walletAddress = await signer.getAddress();
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            
            // Update UI
            connectWalletBtn.style.display = 'none';
            walletAddressDiv.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            
            return true;
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Failed to connect wallet. Please try again.');
            return false;
        }
    } else {
        alert('Please install MetaMask to play with blockchain features!');
        return false;
    }
}

// Connect wallet button
connectWalletBtn.addEventListener('click', initWeb3);

// Load leaderboard
async function loadLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();
        
        if (data.success) {
            displayLeaderboard(data.leaderboard);
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Display leaderboard
function displayLeaderboard(leaderboard) {
    if (leaderboard.length === 0) {
        leaderboardDiv.innerHTML = '<div class="loading">No scores yet. Be the first!</div>';
        return;
    }
    
    leaderboardDiv.innerHTML = leaderboard.map((entry, index) => {
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const truncatedAddress = `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`;
        
        return `
            <div class="leaderboard-entry ${rankClass}">
                <span class="rank">#${entry.rank}</span>
                <div class="player-info">
                    <span class="player-name">${entry.name}</span>
                    <span class="player-address">${truncatedAddress}</span>
                </div>
                <span class="player-score">${entry.score}</span>
            </div>
        `;
    }).join('');
}

// Submit score to blockchain
async function submitScoreToBlockchain() {
    if (!walletAddress) {
        const connected = await initWeb3();
        if (!connected) return;
    }
    
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Please enter your name!');
        return;
    }
    
    try {
        submitScoreBtn.disabled = true;
        submitScoreBtn.textContent = 'Submitting...';
        
        const tx = await contract.submitScore(score, playerName);
        await tx.wait();
        
        alert('Score submitted successfully!');
        loadLeaderboard();
        gameOverOverlay.style.display = 'none';
        gameOverlay.style.display = 'flex';
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Failed to submit score. Please try again.');
    } finally {
        submitScoreBtn.disabled = false;
        submitScoreBtn.textContent = 'Submit to Blockchain';
    }
}

// Game functions
function startGame() {
    gameRunning = true;
    score = 0;
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    pipes.length = 0;
    pipeTimer = 0;
    
    gameOverlay.style.display = 'none';
    gameOverOverlay.style.display = 'none';
    scoreDisplay.textContent = score;
    
    gameLoop();
}

function gameOver() {
    gameRunning = false;
    finalScoreSpan.textContent = score;
    gameOverOverlay.style.display = 'flex';
}

function jump() {
    if (gameRunning) {
        bird.velocity = bird.jump;
    }
}

function createPipe() {
    const minHeight = 100;
    const maxHeight = canvas.height - pipeGap - minHeight;
    const height = Math.random() * (maxHeight - minHeight) + minHeight;
    
    pipes.push({
        x: canvas.width,
        topHeight: height,
        bottomY: height + pipeGap,
        passed: false
    });
}

function updateBird() {
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    
    // Check boundaries
    if (bird.y + bird.size > canvas.height || bird.y - bird.size < 0) {
        gameOver();
    }
}

function updatePipes() {
    // Create new pipes
    pipeTimer++;
    if (pipeTimer > 90) {
        createPipe();
        pipeTimer = 0;
    }
    
    // Update pipe positions
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= pipeSpeed;
        
        // Remove pipes that are off screen
        if (pipes[i].x + pipeWidth < 0) {
            pipes.splice(i, 1);
            continue;
        }
        
        // Check for collisions
        if (bird.x + bird.size > pipes[i].x && 
            bird.x - bird.size < pipes[i].x + pipeWidth) {
            if (bird.y - bird.size < pipes[i].topHeight || 
                bird.y + bird.size > pipes[i].bottomY) {
                gameOver();
            }
        }
        
        // Update score
        if (!pipes[i].passed && bird.x > pipes[i].x + pipeWidth) {
            pipes[i].passed = true;
            score++;
            scoreDisplay.textContent = score;
        }
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw bird
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw bird eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(bird.x + 8, bird.y - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw pipes
    ctx.fillStyle = '#228B22';
    pipes.forEach(pipe => {
        // Top pipe
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        // Bottom pipe
        ctx.fillRect(pipe.x, pipe.bottomY, pipeWidth, canvas.height - pipe.bottomY);
        
        // Pipe caps
        ctx.fillStyle = '#196F3D';
        ctx.fillRect(pipe.x - 5, pipe.topHeight - 30, pipeWidth + 10, 30);
        ctx.fillRect(pipe.x - 5, pipe.bottomY, pipeWidth + 10, 30);
        ctx.fillStyle = '#228B22';
    });
}

function gameLoop() {
    if (!gameRunning) return;
    
    updateBird();
    updatePipes();
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Event listeners
canvas.addEventListener('click', jump);
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        jump();
    }
});

playBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', startGame);
submitScoreBtn.addEventListener('click', submitScoreToBlockchain);

// Load leaderboard on page load
loadLeaderboard();
setInterval(loadLeaderboard, 30000); // Refresh every 30 seconds
