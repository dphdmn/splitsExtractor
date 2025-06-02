function splits(sol) {
    if (!sol.includes("?r=")) return null;
    const queryStart = sol.indexOf('?');
    const queryParams = sol.slice(queryStart + 1).split('&'); 
    let replayParam = '';
    for (const param of queryParams) {
        const [key, value] = param.split('=');
        if (key === 'r') {
            replayParam = value;
            break;
        }
    }
    const replayData = decompressStringToArray(replayParam);
    let solution, scramble, moveTimes;
    if (replayData.length < 10) {
        solution = replayData[0];
        scramble = replayData[2];
        moveTimes = replayData[3];
    } else {
        const solveData = readSolveData(replayData[1]);
        solution = solveData.solutions;
        scramble = puzzleToScramble(parseScrambleGuessSquare(solution));
        moveTimes = solveData.move_times[0];
    }
    const gridsStates = getGridsStates(solution, scramble);
    return calculateSplits(gridsStates, moveTimes, solution, scramble);
}

function calculateSplits(gridsStates, moveTimes, solution, scramble) {
    const solutionLength = expandSolution(solution).length;
    const puzzleMatrix = scrambleToPuzzle(scramble);
    const relevantGridIndices = Object.keys(gridsStates).filter(key => {
        const { activeZone } = gridsStates[key];
        return activeZone.width + 1 >= puzzleMatrix[0].length / 2 && 
               activeZone.height + 1 >= puzzleMatrix.length / 2;
    });
    let splits = [];
    const splitTimes = [];
    const splitMoves = [];
    relevantGridIndices.push(solutionLength - 1);
    let previousTime = 0;
    let previousMoveCount = 0;
    for (const currentIndex of relevantGridIndices.slice(1)) {
        const currentMoveCount = parseInt(currentIndex, 10) + 1;
        const currentTime = moveTimes[currentIndex];
        const splitDuration = currentTime - previousTime;
        const movesInSplit = currentMoveCount - previousMoveCount;
        const movesPerSecond = (movesInSplit * 1000 / splitDuration).toFixed(1);

        //splits.push(
        //    `${formatTime(currentTime)} | ${formatTime(splitDuration)} ` +
       //     `(${movesInSplit} / ${movesPerSecond})`
        //);
        splitTimes.push(splitDuration/1000);
        splitMoves.push(movesInSplit);
        previousTime = currentTime;
        previousMoveCount = currentMoveCount;
    }
    splits = splitTimes.concat(splitMoves);

    return [splits];
}

//"Public" (helper) function to format time from ms
function formatTime(milliseconds, cut = false) {
    const hours = Math.floor(milliseconds / 3600000);
    const remainingMillis = milliseconds % 3600000;
    const minutes = Math.floor(remainingMillis / 60000);
    const remainingSeconds = Math.floor((remainingMillis % 60000) / 1000);
    const millisecondsPart = remainingMillis % 1000;
    if (cut) {
        if (hours > 0) {
            return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
        } else if (minutes > 0) {
            return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
        } else {
            return `${remainingSeconds}.${millisecondsPart.toString().padStart(3, '0')}`;
        }
    } else {
        if (hours > 0) {
            return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}.${millisecondsPart.toString().padStart(3, '0')}`;
        } else if (minutes > 0) {
            return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}.${millisecondsPart.toString().padStart(3, '0')}`;
        } else {
            return `${remainingSeconds}.${millisecondsPart.toString().padStart(3, '0')}`;
        }
    }
}

function readSolveData(input) {
  const decodedString = decodeURIComponent(input);
  const binaryString = Uint8Array.from(atob(decodedString), c => c.charCodeAt(0));
 // Google's built-in base64 decode
  const compressedArray = Uint8Array.from(binaryString);
  const decompressed = pako.inflate(compressedArray, { to: 'string' });
  // decompressed example: RUL2URULD;52.636;1556;29.562;-1.000;[0,37]
  let moveTimes = -1;
  let remainingDecompressed = decompressed;

  // Find the position of the move times (if any)
  const openBracketIndex = decompressed.indexOf('[');
  const closeBracketIndex = decompressed.indexOf(']');

  if (openBracketIndex !== -1 && closeBracketIndex !== -1 && closeBracketIndex > openBracketIndex) {
        // Extract the move times content
        const moveTimesContent = decompressed.slice(openBracketIndex + 1, closeBracketIndex);
        moveTimes = [moveTimesContent.split(',').map(Number)];   
      // Remove the move times portion from the remaining string
      remainingDecompressed = decompressed.slice(0, openBracketIndex) + 
                            decompressed.slice(closeBracketIndex + 1);
  }

  // Clean up any trailing semicolons
  remainingDecompressed = remainingDecompressed.replace(/;+$/, '');

  const parts = remainingDecompressed.split(';');

  return {
      solutions: parts[0] || -1,
      times: parts[1] || -1,
      moves: parts[2] || -1,
      tps: parts[3] || -1,
      bld_times: parts[4] || -1,
      move_times: moveTimes
  };
}

function getGridsStates(solution, customScramble) {
    let scrambleMatrix;
    scrambleMatrix = scrambleToPuzzle(customScramble);
    width = scrambleMatrix[0].length;
    height = scrambleMatrix.length
    const cycledNumbers = getCyclesNumbers(scrambleMatrix, expandSolution(solution));
    let gridsData;
    gridsData = analyseGridsInitial(scrambleMatrix, expandSolution(solution), cycledNumbers);
    let gridsStates;
    gridsStates = generateGridsStats(gridsData);
    return gridsStates;
}

if (typeof atob === 'undefined') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    atob = function (input) {
        let str = input.replace(/=+$/, '');
        let output = '';

        if (str.length % 4 === 1) {
            throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
        }

        for (let bc = 0, bs = 0, buffer, i = 0; 
             buffer = str.charAt(i++); 
             ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) 
                ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6))
                : 0
        ) {
            buffer = chars.indexOf(buffer);
        }

        return output;
    };
}
const cTMap = {
    'fringe': 1,
    'grids1': 2,
    'grids2': 3,
};
function decompressStringToArray(compressedString) {
  const decodedString = decodeURIComponent(compressedString);
  const binaryString = Uint8Array.from(atob(decodedString), c => c.charCodeAt(0));
 // Google's built-in base64 decode
  const compressedArray = Uint8Array.from(binaryString);
  
  // Since TextDecoder isn't available in Apps Script, use pako's built-in string conversion
  const inflatedData = pako.inflate(compressedArray, { to: 'string' });
  
  return JSON.parse(inflatedData);
}
//Module for working with sliding puzzles as a matrix, as well as working with solution strings

/*DEPENDENCIES
None
*/

function getCubicEstimate(time, N, M) {
    return Math.floor(2000*time/(N*M*(N+M)))
}

//"Public" function to get MD value based on puzzleMatrix
function calculateManhattanDistance(scrambledMatrix) {
    const height = scrambledMatrix.length;
    const width = scrambledMatrix[0].length;
    let totalDistance = 0;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const currentValue = scrambledMatrix[i][j];
            if (currentValue !== 0) {
                const targetRow = Math.floor((currentValue - 1) / width);
                const targetCol = (currentValue - 1) % width;

                const distance = Math.abs(targetRow - i) + Math.abs(targetCol - j);
                totalDistance += distance;
            }
        }
    }
    return totalDistance;
}

//"Public" function to expand solution string (R3D3 -> RRRDDD)
function expandSolution(solution) {
    return solution.replace(/([A-Z])(\d+)/g, function (_, l, c) {
        return l.repeat(+c);
    });
}

//"Public" function to compress solution string (RRRDDD -> R3D3)
function compressSolution(input) {
    return input.replace(/(.)\1+/g, function (m, c) {
        return c + m.length;
    });
}

//"Public" function to get amount of repeated moves in expanded solution string (RL/DU separately)
function getRepeatedLengths(inputString) {
    let repeatedWidth = 0;
    let repeatedHeight = 0;
    for (let i = 1; i < inputString.length; i++) {
        if (inputString[i] === inputString[i - 1]) {
            if ('DU'.includes(inputString[i])) repeatedHeight++;
            if ('RL'.includes(inputString[i])) repeatedWidth++;
        }
    }
    return { repeatedWidth, repeatedHeight };
}

//"Public" function to make a move (RULD) on a puzzleMatrix
function moveMatrix(matrix, movetype, zeroPos, width, height) {
    const updatedMatrix = matrix;
    const zeroRow = zeroPos[0];
    const zeroCol = zeroPos[1];
    switch (movetype) {
        case 'R':
            if (zeroCol > 0) {
                [updatedMatrix[zeroRow][zeroCol], updatedMatrix[zeroRow][zeroCol - 1]] = [updatedMatrix[zeroRow][zeroCol - 1], updatedMatrix[zeroRow][zeroCol]];
            } else {
                throw new Error("Invalid move: " + movetype + "\nPuzzle state: " + puzzleToScramble(matrix));
            }
            break;
        case 'L':
            if (zeroCol < width - 1) {
                [updatedMatrix[zeroRow][zeroCol], updatedMatrix[zeroRow][zeroCol + 1]] = [updatedMatrix[zeroRow][zeroCol + 1], updatedMatrix[zeroRow][zeroCol]];
            } else {
                throw new Error("Invalid move: " + movetype + "\nPuzzle state: " + puzzleToScramble(matrix));
            }
            break;
        case 'U':
            if (zeroRow < height - 1) {
                [updatedMatrix[zeroRow][zeroCol], updatedMatrix[zeroRow + 1][zeroCol]] = [updatedMatrix[zeroRow + 1][zeroCol], updatedMatrix[zeroRow][zeroCol]];
            } else {
                throw new Error("Invalid move: " + movetype + "\nPuzzle state: " + puzzleToScramble(matrix));
            }
            break;
        case 'D':
            if (zeroRow > 0) {
                [updatedMatrix[zeroRow][zeroCol], updatedMatrix[zeroRow - 1][zeroCol]] = [updatedMatrix[zeroRow - 1][zeroCol], updatedMatrix[zeroRow][zeroCol]];
            } else {
                throw new Error("Invalid move: " + movetype + "\nPuzzle state: " + puzzleToScramble(matrix));
            }
            break;
        default:
            throw new Error("Unexpected move character: " + movetype + "\nPuzzle state: " + puzzleToScramble(matrix));
    }
    return updatedMatrix;
}

//"Public" function to (forcefully) apply Expanded solution on puzzleMatrix (!use moveMatrix for safe approach!)
function applyMoves(matrix, moves) {
    const h = matrix.length, w = matrix[0].length;
    let y = -1, x = -1;
    for (let i = 0; i < h; i++)
        for (let j = 0; j < w; j++)
            if (matrix[i][j] === 0) [y, x] = [i, j];
    for (const move of moves) {
        const [dy, dx] = {
            U: [1, 0],
            D: [-1, 0],
            L: [0, 1],
            R: [0, -1]
        }[move];
        const [ny, nx] = [y + dy, x + dx];
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) {
            return -1;
        }
        [matrix[y][x], matrix[ny][nx]] = [matrix[ny][nx], matrix[y][x]];
        [y, x] = [ny, nx];
    }
    return matrix;
}

//"Public" function to find position of empty tile on a puzzleMatrix
function findZero(matrix, width, height) {
    let zeroRow, zeroCol;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (matrix[i][j] === 0) {
                zeroRow = i;
                zeroCol = j;
                break;
            }
        }
    }
    return [zeroRow, zeroCol];
}

//"Public" function to reverse Expanded solution string (RRRDDD -> UUULLL)
function reverseSolution(solution) {
    return solution.split('').reverse().map(function (l) {
        return ({ U: 'D', D: 'U', L: 'R', R: 'L' }[l] || l);
    }).join('');
}

//"Public" function to guess size of the puzzle based on solution string (largest NxM)
function guessSize(solution) {
    solution = reverseSolution(expandSolution(solution))
    let x = 1,
        y = 1,
        width = 0,
        height = 0;
    for (const move of solution) {
        if (move === 'D') y++;
        if (move === 'R') x++;
        if (move === 'U') y--;
        if (move === 'L') x--;
        width = Math.max(width, x);
        height = Math.max(height, y);
    }
    return [Math.max(2, width), Math.max(2, height)];
}

//"Public" function to guess size of the puzzle based on solution string (largest Square)
function guessSizeSquare(solution) {
    const arr = guessSize(solution);
    return Math.max(arr[0], arr[1]);
}

//"Public" function to check if input string is slidysim-style scramble (no parity checking)
function validateScramble(input) {
    if (!/^[0-9\s/]*$/.test(input)) {
        return false;
    }
    const parts = input.split('/');
    const numCounts = parts.map(part => part.split(' ').length);
    const allEqual = numCounts.every(count => count === numCounts[0]);
    const allNumbers = input.split(/\s|\/| /).map(Number);
    const sortedNumbers = [...allNumbers].sort((a, b) => a - b);
    const isSequential = sortedNumbers.every((num, index) => num === index);
    return allEqual && isSequential;
}

//"Public" function to create puzzleMatrix based on slidysim-style scramble
function scrambleToPuzzle(inputString) {
    return inputString.split('/').map(row => row.split(' ').map(Number));
}

//"Public" function to create solved puzzleMatrix of given size
function createPuzzle(width, height) {
    let counter = 1;
    return Array.from({
        length: height
    }, (_, i) => Array.from({
        length: width
    }, (_, j) => (i === height - 1 && j === width - 1) ? 0 : counter++));
}

//"Public" function to create slidysim-style scramble based on puzzleMatrix
function puzzleToScramble(puzzle) {
    return puzzle.map(row => row.join(' ')).join('/');
}

//"Public" function to parse puzzleMatrix from the valid solution for given size
function parseScramble(width, height, solution) {
    return applyMoves(createPuzzle(width, height), reverseSolution(expandSolution(solution)));
}

//"Public" function to parse puzzleMatrix from the valid solution for biggest NxM size
function parseScrambleGuess(solution) {
    const sizeGuess = guessSize(solution);
    return parseScramble(sizeGuess[0], sizeGuess[1], solution);
}

//"Public" function to parse puzzleMatrix from the valid solution for biggest square size
function parseScrambleGuessSquare(solution) {
    const sizeGuess = guessSizeSquare(solution);
    return parseScramble(sizeGuess, sizeGuess, solution);
}

//"Public" function to expand puzzleMatrix to a bigger puzzle with size WxH (bottom-right)
function expandMatrix(matrix, W, H) {
    const numRows = matrix.length;
    const numCols = matrix[0].length;
    const numRowsDiff = W - numRows;
    const numColsDiff = H - numCols;
    const expandedMatrix = createPuzzle(W, H);
    const mappingMatrix = createPuzzle(W, H);
    for (let i = 0; i < numRows; i++) {
        for (let j = 0; j < numCols; j++) {
            const value = matrix[i][j];
            let originalValue = 0;
            if (value !== 0) {
                const rowIndex = Math.floor((value - 1) / numCols);
                const colIndex = (value - 1) % numCols;
                originalValue = mappingMatrix[rowIndex + numRowsDiff][colIndex + numColsDiff];
            }
            expandedMatrix[i + numRowsDiff][j + numColsDiff] = originalValue;
        }
    }
    return expandedMatrix;
}


//Module for automatically detecting grids color schemes for sliding puzzles bigger than 5x5

/*DEPENDENCIES
slidingPuzzle.js
*/

//"Public" (mostly experimental) Function to guess possible cycles in the solution
function getCyclesNumbers(matrix, solution, movesEarly = 0.96, movesLate = 0.98, safeRect = 0.5) {
    width = matrix[0].length;
    height = matrix.length;
    solLen = solution.length;
    earlyCount = movesEarly * solLen;
    lateCount = movesLate * solLen;
    safeWidth = Math.round(width * safeRect);
    safeHeight = Math.round(height * safeRect);
    let unsolvedInfo = [];
    matrixCopy = JSON.parse(JSON.stringify(matrix));
    for (let moveIndex = 0; moveIndex < lateCount; moveIndex++) {
        const move = solution[moveIndex];
        const zeroPos = findZero(matrixCopy, width, height);
        matrixCopy = moveMatrix(matrixCopy, move, zeroPos, width, height);
        if (moveIndex > earlyCount) {
            unsolvedInfo.push(getSolveElementsAmount(matrixCopy, safeWidth, safeHeight));
        }
    }
    try {
        return unsolvedInfo.reduce((min, current) => current.amount < min.amount ? current : min)
            .arrayOfUnsolved;
    } catch (error) {
        return [];
    }
}

//"Public" Function to analyse grids based on matrix, solution, and list of cycles
function analyseGridsInitial(matrix, solution, cycledNumbers) {
    const height = matrix.length;
    const width = matrix[0].length;
    return analyseGrids(matrix, solution, width, height, width, height, 0, 0, 0, cycledNumbers);
}

//"Public" Function to Generates Grids based on guessed data
function generateGridsStats(gridsData) {
    const levels = {};
    (function traverse(node, id) {
        if (node) {
            levels[id] = getDataByLevel(node);
            traverse(node.nextLayerFirst, node.gridsStarted);
            traverse(node.nextLayerSecond, node.gridsStopped);
        }
    })(gridsData, 0);
    return levels;
}

//"Public" Function to directly get state of grids based on current move index 
function getGridsState(gridsStates, moveIndex) {
    const keys = Object.keys(gridsStates).map(Number);
    const highestKey = keys.reduce((acc, key) => (key <= moveIndex ? key : acc), -1);
    return gridsStates[highestKey];
}
//_________________End of "Public" functions of this module_________________//

//_________________"Private" Functions for generateGridsStats_________________//

function getDataByLevel(currentLevel) {
    return {
        secondaryColors: getSecondaryColorsByLevel(currentLevel),
        mainColors: getMainColorsByLevel(currentLevel),
        activeZone: getActiveZoneByLevel(currentLevel)
    };
}

function getActiveZoneByLevel(currentLevel) {
    return getSizesForLayer(0, currentLevel);
}

function getMainColorsByLevel(currentLevel) {
    if (currentLevel.enableGridsStatus === -1) {
        return [getSizesForLayer(cTMap['fringe'], currentLevel)];
    }
    return [
        getSizesForLayer(cTMap['grids1'], currentLevel.nextLayerFirst),
        getSizesForLayer(cTMap['grids2'], currentLevel.nextLayerSecond)
    ];
}

function getSecondaryColorsByLevel(currentLevel) {
    let secondaryColors = [];
    if (currentLevel.enableGridsStatus === -1) {
        return secondaryColors;
    }
    const fL = currentLevel.nextLayerFirst;
    const sL = currentLevel.nextLayerSecond;
    if (fL.nextLayerFirst) {
        secondaryColors.push(getSizesForLayer(cTMap['grids1'], fL.nextLayerFirst));
        secondaryColors.push(getSizesForLayer(cTMap['grids2'], fL.nextLayerSecond));
    } else {

        secondaryColors.push(getSizesForLayer(cTMap['fringe'], fL));
    }
    if (sL.nextLayerSecond) {
        secondaryColors.push(getSizesForLayer(cTMap['grids1'], sL.nextLayerFirst));
        secondaryColors.push(getSizesForLayer(cTMap['grids2'], sL.nextLayerSecond));
    } else {
        secondaryColors.push(getSizesForLayer(cTMap['fringe'], sL));
    }
    return secondaryColors;
}

function getSizesForLayer(typeN, layer) {
    return {
        type: typeN,
        width: layer.width,
        height: layer.height,
        offsetW: layer.offsetW,
        offsetH: layer.offsetH
    };
}

//_________________"Private" Functions for generateGridsStats ends_________________//

//_________________"Private" Functions for analyseGridsInitial_________________//

function analyseGrids(matrix, solution, widthInitial, heightInitial, width, height, offsetW, offsetH, movesOffsetCounter, cycledNumbers) {
    let matrixCopy = JSON.parse(JSON.stringify(matrix));
    for (let moveIndex = 0; moveIndex < solution.length; moveIndex++) {
        const move = solution[moveIndex];
        const zeroPos = findZero(matrixCopy, widthInitial, heightInitial);
        matrixCopy = moveMatrix(matrixCopy, move, zeroPos, widthInitial, heightInitial);
        const gridsStatus = guessGrids(matrixCopy, width, height, offsetW, offsetH, widthInitial);
        if (gridsStatus !== 0) {
            let gridsStarted = moveIndex;
            let enableGridsStatus = gridsStatus;
            let girdsUnsolvedLast = null;
            let matrixBeforeGrids = JSON.parse(JSON.stringify(matrixCopy));
            for (let gridsStoppedTempID = gridsStarted + 1; gridsStoppedTempID < solution.length; gridsStoppedTempID++) {
                const move = solution[gridsStoppedTempID];
                const zeroPos = findZero(matrixCopy, widthInitial, heightInitial);
                matrixCopy = moveMatrix(matrixCopy, move, zeroPos, widthInitial, heightInitial);
                if (!gridsSolved(matrixCopy, width, height, offsetW, offsetH, enableGridsStatus, widthInitial, cycledNumbers)) {
                    girdsUnsolvedLast = gridsStoppedTempID;
                } else {
                    break;
                }
            }
            if (girdsUnsolvedLast === null) {
                return "Error, grids never stopped";
            } else {
                const gridsStopped = girdsUnsolvedLast + 1;
                const sol1 = solution.slice(gridsStarted + 1, gridsStopped + 2);
                const sol2 = solution.slice(gridsStopped + 2);
                const newParts = getGridsParts(matrixBeforeGrids, sol1, widthInitial, heightInitial);
                if (newParts !== null) {
                    if (enableGridsStatus === 1) {
                        //top grids
                        const width_First = width;
                        const width_Second = width;
                        const offsetW_First = offsetW;
                        const offsetW_Second = offsetW;
                        const height_First = Math.ceil(height / 2);
                        const height_Second = height - height_First;
                        const offsetH_First = offsetH;
                        const offsetH_Second = height_First + offsetH;
                        return {
                            enableGridsStatus,
                            gridsStarted: gridsStarted + movesOffsetCounter,
                            gridsStopped: gridsStopped + movesOffsetCounter,
                            width,
                            height,
                            offsetW,
                            offsetH,
                            nextLayerFirst: analyseGrids(newParts[0], sol1, widthInitial, heightInitial, width_First, height_First, offsetW_First, offsetH_First, movesOffsetCounter + gridsStarted + 1, cycledNumbers),
                            nextLayerSecond: analyseGrids(newParts[1], sol2, widthInitial, heightInitial, width_Second, height_Second, offsetW_Second, offsetH_Second, movesOffsetCounter + gridsStopped + 1, cycledNumbers)
                        };
                    }
                    if (enableGridsStatus === 2) {
                        //left grids
                        const width_First = Math.ceil(width / 2);
                        const width_Second = width - width_First;
                        const offsetW_First = offsetW;
                        const offsetW_Second = width_First + offsetW;
                        const height_First = height;
                        const height_Second = height;
                        const offsetH_First = offsetH;
                        const offsetH_Second = offsetH;
                        return {
                            enableGridsStatus,
                            gridsStarted: gridsStarted + movesOffsetCounter,
                            gridsStopped: gridsStopped + movesOffsetCounter,
                            width,
                            height,
                            offsetW,
                            offsetH,
                            nextLayerFirst: analyseGrids(newParts[0], sol1, widthInitial, heightInitial, width_First, height_First, offsetW_First, offsetH_First, movesOffsetCounter + gridsStarted + 1, cycledNumbers),
                            nextLayerSecond: analyseGrids(newParts[1], sol2, widthInitial, heightInitial, width_Second, height_Second, offsetW_Second, offsetH_Second, movesOffsetCounter + gridsStopped + 1, cycledNumbers)
                        };
                    }
                }
                return {
                    enableGridsStatus,
                    gridsStarted,
                    gridsStopped,
                    width,
                    height,
                    offsetW,
                    offsetH,
                    nextLayerFirst: null,
                    nextLayerSecond: null
                };
            }
        }
    }
    return {
        enableGridsStatus: -1,
        width,
        height,
        offsetW,
        offsetH,
    };
}

function getGridsParts(matrixBeforeGrids, solution, width, height) {
    if (width < 6 && height < 6) {
        return null;
    }
    const firstMatrix = JSON.parse(JSON.stringify(matrixBeforeGrids));
    for (let moveIndex = 0; moveIndex < solution.length; moveIndex++) {
        const move = solution[moveIndex];
        const zeroPos = findZero(matrixBeforeGrids, width, height);
        matrixBeforeGrids = moveMatrix(matrixBeforeGrids, move, zeroPos, width, height);
    }

    const secondMatrix = matrixBeforeGrids;
    return [firstMatrix, secondMatrix];
}

function guessGrids(matrix, width, height, offsetW, offsetH, widthInitial) {
    //2 left-right grids
    //1 top-bottom grids (checks first)
    //0 no grids
    if (width < 6 && height < 6) {
        return 0;
    }
    if (height > 5) {
        if (checkTopBottom(matrix, width, height, offsetW, offsetH, widthInitial)) {
            return 1;
        }
    }
    if (width > 5) {
        if (checkLeftRight(matrix, width, height, offsetW, offsetH, widthInitial)) {
            return 2;
        }
    }
    return 0;
}

function checkTopBottom(matrix, width, height, offsetW, offsetH, widthInitial) {
    let newH = Math.ceil(height / 2) + offsetH;
    let solvedCounter = 0;
    for (let row = offsetH; row < newH; row++) {
        for (let col = offsetW; col < width + offsetW; col++) {
            const number = matrix[row][col];
            if (number !== 0 && Math.floor((number - 1) / widthInitial) >= newH) {
                return false;
            }
            if (numberIsSovled(number, row, col, widthInitial)) {
                solvedCounter++;
            }
        }
    }
    return width * (newH - offsetH) / 3 > solvedCounter;
}

function checkLeftRight(matrix, width, height, offsetW, offsetH, widthInitial) {
    let newW = Math.ceil(width / 2) + offsetW;
    let solvedCounter = 0;
    for (let row = offsetH; row < height + offsetH; row++) {
        for (let col = offsetW; col < newW; col++) {
            const number = matrix[row][col];
            if (number !== 0 && (number - 1) % widthInitial >= newW) {
                return false;
            }
            if (numberIsSovled(number, row, col, widthInitial)) {
                solvedCounter++;
            }
        }
    }
    return height * (newW - offsetW) / 3 > solvedCounter;
}

function gridsSolved(matrix, width, height, offsetW, offsetH, gridsType, widthInitial, cycledNumbers) {
    //2 left-right grids
    //1 top-bottom grids 
    if (gridsType === 1) {
        let newH = Math.ceil(height / 2) + offsetH;
        for (let row = offsetH; row < newH; row++) {
            for (let col = offsetW; col < width + offsetW; col++) {
                const number = matrix[row][col];
                if (number !== 0 && !numberIsSovled(number, row, col, widthInitial)) {
                    if (!cycledNumbers.includes(number)) {
                        return false;
                    }
                }
            }
        }
    }
    if (gridsType === 2) {
        let newW = Math.ceil(width / 2) + offsetW;
        for (let row = offsetH; row < height + offsetH; row++) {
            for (let col = offsetW; col < newW; col++) {
                const number = matrix[row][col];
                if (number !== 0 && !numberIsSovled(number, row, col, widthInitial)) {
                    if (!cycledNumbers.includes(number)) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}

function numberIsSovled(number, row, col, width) {
    if (number === 0) {
        return false;
    }
    return (Math.floor((number - 1) / width) === row && (number - 1) % width === col);
}

//_________________"Private" Functions for analyseGridsInitial ends_________________//

//_________________"Private" Functions for getCyclesNumbers_________________//

function getSolveElementsAmount(matrix, safeWidth = 0, safeHeight = 0) {
    const flatMatrix = matrix.flat();
    const N = flatMatrix.length;
    const unsolved = flatMatrix.filter((num, index) => {
        if (num === 0) return false;
        const expectedRow = Math.floor(index / matrix[0].length);
        const expectedCol = index % matrix[0].length;
        return (
            num !== expectedRow * matrix[0].length + expectedCol + 1 &&
            !(expectedRow >= matrix.length - safeHeight && expectedCol >= matrix[0].length - safeWidth)
        );
    });
    return {
        amount: unsolved.length,
        arrayOfUnsolved: unsolved
    };
}

//_________________"Private" Functions for getCyclesNumbers ends_________________//
