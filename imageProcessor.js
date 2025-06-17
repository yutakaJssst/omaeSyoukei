// 画像処理メイン関数
async function processImage(imageElement) {
    try {
        // 特徴抽出のためのキャンバスを準備
        const featureCanvas = document.getElementById('featureCanvas');
        const ctx = featureCanvas.getContext('2d');
        
        // キャンバスのサイズを画像に合わせる
        featureCanvas.width = imageElement.naturalWidth;
        featureCanvas.height = imageElement.naturalHeight;
        
        // 元の画像をキャンバスに描画
        ctx.drawImage(imageElement, 0, 0);
        
        // 画像データを取得
        const imageData = ctx.getImageData(0, 0, featureCanvas.width, featureCanvas.height);
        
        // 特徴抽出処理
        const features = await extractFeatures(imageElement);
        
        // 特徴を可視化
        visualizeFeatures(features, featureCanvas);
        
        // 特徴から文字を生成
        const character = generateCharacterFromFeatures(features);
        
        // 生成された文字を表示
        displayGeneratedCharacter(character);
        
        return true;
    } catch (error) {
        console.error('画像処理エラー:', error);
        throw error;
    }
}

// 多層特徴抽出メイン関数
async function extractFeatures(imageElement) {
    try {
        // 結果を格納するオブジェクト
        const features = {
            lowLevel: {}, // 低レベル特徴（色、テクスチャなど）
            midLevel: {}, // 中間レベル特徴（エッジ、コーナーなど）
            highLevel: {}, // 高レベル特徴（形状、パターンなど）
            semantic: {}  // 意味的特徴（オブジェクト認識など）
        };
        
        // 1. 低レベル特徴抽出
        features.lowLevel = extractLowLevelFeatures(imageElement);
        
        // 2. 中間レベル特徴抽出（エッジ検出を含む）
        features.midLevel = await extractMidLevelFeatures(imageElement);
        
        // 3. 高レベル特徴抽出
        features.highLevel = extractHighLevelFeatures(features.midLevel);
        
        // 4. 意味的特徴抽出（BodyPixなどのモデルを使用）
        features.semantic = await extractSemanticFeatures(imageElement);
        
        // 5. 特徴の統合と分析
        const integratedFeatures = integrateAndAnalyzeFeatures(features);
        
        return integratedFeatures;
    } catch (error) {
        console.error('特徴抽出エラー:', error);
        // エラーが発生した場合は、従来の方法にフォールバック
        return extractEdgesAndFeatures(null, imageElement);
    }
}

// エッジ検出と特徴抽出
function extractEdgesAndFeatures(segmentation, imageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    const ctx = canvas.getContext('2d');
    
    // 元の画像を描画
    ctx.drawImage(imageElement, 0, 0);
    
    // 画像データを取得
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // セグメンテーションマスクを使用してエッジを検出
    const edgeData = new Uint8ClampedArray(data.length);
    const mask = segmentation.data;
    
    // エッジ検出（簡易的なSobelフィルタ）
    for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            
            // マスクがある部分（人物や物体）のみ処理
            if (mask[y * canvas.width + x]) {
                // 周囲のピクセルとの差分を計算（エッジ検出）
                const gx = 
                    -1 * data[((y-1) * canvas.width + (x-1)) * 4] +
                    -2 * data[((y) * canvas.width + (x-1)) * 4] +
                    -1 * data[((y+1) * canvas.width + (x-1)) * 4] +
                    1 * data[((y-1) * canvas.width + (x+1)) * 4] +
                    2 * data[((y) * canvas.width + (x+1)) * 4] +
                    1 * data[((y+1) * canvas.width + (x+1)) * 4];
                
                const gy = 
                    -1 * data[((y-1) * canvas.width + (x-1)) * 4] +
                    -2 * data[((y-1) * canvas.width + (x)) * 4] +
                    -1 * data[((y-1) * canvas.width + (x+1)) * 4] +
                    1 * data[((y+1) * canvas.width + (x-1)) * 4] +
                    2 * data[((y+1) * canvas.width + (x)) * 4] +
                    1 * data[((y+1) * canvas.width + (x+1)) * 4];
                
                // エッジの強さを計算
                const g = Math.sqrt(gx * gx + gy * gy);
                
                // しきい値以上の場合はエッジとして検出
                if (g > 50) {
                    edgeData[idx] = 255;     // R
                    edgeData[idx + 1] = 255; // G
                    edgeData[idx + 2] = 255; // B
                    edgeData[idx + 3] = 255; // A
                }
            }
        }
    }
    
    // 特徴点を抽出（エッジの交点や端点など）
    const features = {
        edges: edgeData,
        width: canvas.width,
        height: canvas.height,
        keyPoints: extractKeyPoints(edgeData, canvas.width, canvas.height)
    };
    
    return features;
}

// 特徴点（キーポイント）を抽出
function extractKeyPoints(edgeData, width, height) {
    const keyPoints = [];
    const gridSize = 20; // グリッドサイズ
    
    // グリッドベースで特徴点を抽出
    for (let y = 0; y < height; y += gridSize) {
        for (let x = 0; x < width; x += gridSize) {
            let maxEdgeStrength = 0;
            let maxX = 0;
            let maxY = 0;
            
            // グリッド内で最も強いエッジを持つ点を探す
            for (let dy = 0; dy < gridSize && y + dy < height; dy++) {
                for (let dx = 0; dx < gridSize && x + dx < width; dx++) {
                    const idx = ((y + dy) * width + (x + dx)) * 4;
                    const edgeStrength = edgeData[idx];
                    
                    if (edgeStrength > maxEdgeStrength) {
                        maxEdgeStrength = edgeStrength;
                        maxX = x + dx;
                        maxY = y + dy;
                    }
                }
            }
            
            // 一定以上の強さを持つエッジ点を特徴点として追加
            if (maxEdgeStrength > 100) {
                keyPoints.push({
                    x: maxX,
                    y: maxY,
                    strength: maxEdgeStrength
                });
            }
        }
    }
    
    return keyPoints;
}

// 特徴の可視化
function visualizeFeatures(features, canvas) {
    const ctx = canvas.getContext('2d');
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // エッジを描画
    const edgeImageData = new ImageData(features.edges, features.width, features.height);
    ctx.putImageData(edgeImageData, 0, 0);
    
    // キーポイントを描画
    ctx.fillStyle = 'red';
    features.keyPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

// 特徴から文字を生成
function generateCharacterFromFeatures(features) {
    // 特徴点の分布を分析
    const keyPoints = features.keyPoints;
    
    if (keyPoints.length === 0) {
        return '?'; // 特徴点がない場合
    }
    
    // 特徴点の重心を計算
    let centerX = 0;
    let centerY = 0;
    
    keyPoints.forEach(point => {
        centerX += point.x;
        centerY += point.y;
    });
    
    centerX /= keyPoints.length;
    centerY /= keyPoints.length;
    
    // 特徴点の分布パターンを分析
    const patterns = analyzePatterns(keyPoints, centerX, centerY, features.width, features.height);
    
    // パターンに基づいて文字を選択
    const character = selectCharacterFromPatterns(patterns);
    
    return character;
}

// 特徴点のパターンを分析
function analyzePatterns(keyPoints, centerX, centerY, width, height) {
    // 特徴点の分布パターンを分析するための変数
    const patterns = {
        horizontalLines: 0,
        verticalLines: 0,
        diagonalLines: 0,
        curves: 0,
        density: keyPoints.length / (width * height),
        symmetryX: 0,
        symmetryY: 0,
        aspectRatio: 0
    };
    
    // 水平・垂直・対角線の検出
    const angleHistogram = new Array(8).fill(0);
    
    // キーポイント間の関係を分析
    for (let i = 0; i < keyPoints.length; i++) {
        for (let j = i + 1; j < keyPoints.length; j++) {
            const dx = keyPoints[j].x - keyPoints[i].x;
            const dy = keyPoints[j].y - keyPoints[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 近い点同士のみ分析
            if (distance < 50) {
                // 角度を計算（0-7の8方向に量子化）
                const angle = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 8) % 8;
                angleHistogram[angle]++;
                
                // 線の種類をカウント
                if (angle === 0 || angle === 4) {
                    patterns.horizontalLines++;
                } else if (angle === 2 || angle === 6) {
                    patterns.verticalLines++;
                } else {
                    patterns.diagonalLines++;
                }
            }
        }
    }
    
    // 左右対称性を計算
    let leftPoints = 0;
    let rightPoints = 0;
    
    keyPoints.forEach(point => {
        if (point.x < centerX) {
            leftPoints++;
        } else {
            rightPoints++;
        }
    });
    
    patterns.symmetryX = 1 - Math.abs(leftPoints - rightPoints) / keyPoints.length;
    
    // 上下対称性を計算
    let topPoints = 0;
    let bottomPoints = 0;
    
    keyPoints.forEach(point => {
        if (point.y < centerY) {
            topPoints++;
        } else {
            bottomPoints++;
        }
    });
    
    patterns.symmetryY = 1 - Math.abs(topPoints - bottomPoints) / keyPoints.length;
    
    // アスペクト比を計算
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    
    keyPoints.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    });
    
    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;
    
    patterns.aspectRatio = boundingWidth / (boundingHeight || 1);
    
    return patterns;
}

// パターンから文字を選択
function selectCharacterFromPatterns(patterns) {
    // 日本語の文字セット（ひらがな、カタカナ、漢字の一部）
    const japaneseChars = [
        'あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ',
        'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と',
        'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ',
        'ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ',
        'ら', 'り', 'る', 'れ', 'ろ', 'わ', 'を', 'ん',
        'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
        '山', '川', '田', '木', '火', '水', '土', '金', '月', '日'
    ];
    
    // 英数字の文字セット
    const alphanumericChars = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
        'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
        'U', 'V', 'W', 'X', 'Y', 'Z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ];
    
    // 記号の文字セット
    const symbolChars = [
        '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
        '-', '+', '=', '[', ']', '{', '}', '|', '\\', '/',
        '<', '>', '?', '.', ',', ';', ':', '"', "'"
    ];
    
    // すべての文字セットを結合
    const allChars = [...japaneseChars, ...alphanumericChars, ...symbolChars];
    
    // パターンに基づいて文字を選択するロジック
    // 実際のアプリケーションでは、より洗練されたアルゴリズムが必要かもしれません
    
    // パターンの特徴に基づいてスコアを計算
    const scores = allChars.map((char, index) => {
        // 文字ごとに特徴的なパターンを定義（実際にはもっと複雑なマッピングが必要）
        let score = 0;
        
        // 水平線が多い文字（E, F, H, =など）
        if (patterns.horizontalLines > patterns.verticalLines * 1.5) {
            if (['E', 'F', 'H', '=', 'B', 'A', 'G', 'P', 'R', '三', '王', '工'].includes(char)) {
                score += 3;
            }
        }
        
        // 垂直線が多い文字（I, L, T, 1など）
        if (patterns.verticalLines > patterns.horizontalLines * 1.5) {
            if (['I', 'L', 'T', '1', '|', 'り', 'い', 'け', '川', '小'].includes(char)) {
                score += 3;
            }
        }
        
        // 対角線が多い文字（K, N, X, Zなど）
        if (patterns.diagonalLines > (patterns.horizontalLines + patterns.verticalLines) * 0.8) {
            if (['K', 'N', 'X', 'Z', 'M', 'W', 'V', 'A', '火', 'み'].includes(char)) {
                score += 3;
            }
        }
        
        // 左右対称性が高い文字（A, T, V, W, Xなど）
        if (patterns.symmetryX > 0.7) {
            if (['A', 'T', 'V', 'W', 'X', 'Y', 'M', 'O', '山', '田', 'め', 'ゆ'].includes(char)) {
                score += 2;
            }
        }
        
        // 上下対称性が高い文字（B, C, D, E, Kなど）
        if (patterns.symmetryY > 0.7) {
            if (['B', 'C', 'D', 'E', 'K', 'O', 'S', 'X', '日', '田', 'の', 'め'].includes(char)) {
                score += 2;
            }
        }
        
        // アスペクト比が横長の文字（E, F, L, Zなど）
        if (patterns.aspectRatio > 1.5) {
            if (['E', 'F', 'L', 'Z', '-', '=', '_', '一', '二', 'こ'].includes(char)) {
                score += 2;
            }
        }
        
        // アスペクト比が縦長の文字（I, J, 1, |など）
        if (patterns.aspectRatio < 0.7) {
            if (['I', 'J', '1', '|', '!', 'り', 'い', '川', '小'].includes(char)) {
                score += 2;
            }
        }
        
        // 密度が高い文字（B, 8, &など）
        if (patterns.density > 0.01) {
            if (['B', '8', '&', '#', '@', 'の', 'あ', '田', '重'].includes(char)) {
                score += 2;
            }
            
            // 低レベル特徴抽出関数
            function extractLowLevelFeatures(imageElement) {
                const canvas = document.createElement('canvas');
                canvas.width = imageElement.naturalWidth;
                canvas.height = imageElement.naturalHeight;
                const ctx = canvas.getContext('2d');
                
                // 画像を描画
                ctx.drawImage(imageElement, 0, 0);
                
                // 画像データを取得
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // 色ヒストグラム（RGB各チャンネル）
                const histogramR = new Array(256).fill(0);
                const histogramG = new Array(256).fill(0);
                const histogramB = new Array(256).fill(0);
                
                // HSV色空間の分布
                const hsvDistribution = {
                    hue: new Array(360).fill(0),
                    saturation: new Array(101).fill(0),
                    value: new Array(101).fill(0)
                };
                
                // 画像全体をスキャンして特徴を抽出
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // RGBヒストグラム更新
                    histogramR[r]++;
                    histogramG[g]++;
                    histogramB[b]++;
                    
                    // RGB→HSV変換
                    const hsv = rgbToHsv(r, g, b);
                    
                    // HSV分布更新
                    hsvDistribution.hue[Math.floor(hsv.h)]++;
                    hsvDistribution.saturation[Math.floor(hsv.s * 100)]++;
                    hsvDistribution.value[Math.floor(hsv.v * 100)]++;
                }
                
                // 正規化
                const pixelCount = canvas.width * canvas.height;
                const normalizeHistogram = (hist) => hist.map(v => v / pixelCount);
                
                // 主要な色を抽出
                const dominantColors = extractDominantColors(histogramR, histogramG, histogramB);
                
                return {
                    histograms: {
                        r: normalizeHistogram(histogramR),
                        g: normalizeHistogram(histogramG),
                        b: normalizeHistogram(histogramB)
                    },
                    hsvDistribution: {
                        hue: normalizeHistogram(hsvDistribution.hue),
                        saturation: normalizeHistogram(hsvDistribution.saturation),
                        value: normalizeHistogram(hsvDistribution.value)
                    },
                    dominantColors: dominantColors,
                    textureFeatures: calculateSimpleTextureFeatures(imageData)
                };
            }
            
            // RGB→HSV変換関数
            function rgbToHsv(r, g, b) {
                r /= 255;
                g /= 255;
                b /= 255;
                
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;
                
                let h = 0;
                let s = max === 0 ? 0 : delta / max;
                let v = max;
                
                if (delta !== 0) {
                    if (max === r) {
                        h = ((g - b) / delta) % 6;
                    } else if (max === g) {
                        h = (b - r) / delta + 2;
                    } else {
                        h = (r - g) / delta + 4;
                    }
                    
                    h = Math.round(h * 60);
                    if (h < 0) h += 360;
                }
                
                return { h, s, v };
            }
            
            // 主要な色を抽出
            function extractDominantColors(histR, histG, histB, maxColors = 5) {
                // ヒストグラムからカラーマップを作成
                const colorMap = new Map();
                
                for (let r = 0; r < 256; r += 8) {
                    for (let g = 0; g < 256; g += 8) {
                        for (let b = 0; b < 256; b += 8) {
                            // 量子化された色の中心値
                            const rCenter = Math.min(r + 4, 255);
                            const gCenter = Math.min(g + 4, 255);
                            const bCenter = Math.min(b + 4, 255);
                            
                            // この色の出現頻度を計算
                            let count = 0;
                            for (let dr = 0; dr < 8 && r + dr < 256; dr++) {
                                for (let dg = 0; dg < 8 && g + dg < 256; dg++) {
                                    for (let db = 0; db < 8 && b + db < 256; db++) {
                                        const rVal = r + dr;
                                        const gVal = g + dg;
                                        const bVal = b + db;
                                        count += histR[rVal] * histG[gVal] * histB[bVal];
                                    }
                                }
                            }
                            
                            if (count > 0) {
                                const colorKey = `${rCenter},${gCenter},${bCenter}`;
                                colorMap.set(colorKey, { r: rCenter, g: gCenter, b: bCenter, count });
                            }
                        }
                    }
                }
                
                // 出現頻度でソート
                const sortedColors = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
                
                // 上位の色を返す
                return sortedColors.slice(0, maxColors);
            }
            
            // 簡易的なテクスチャ特徴計算
            function calculateSimpleTextureFeatures(imageData) {
                const data = imageData.data;
                const width = imageData.width;
                const height = imageData.height;
                
                let contrast = 0;
                let energy = 0;
                let homogeneity = 0;
                let entropy = 0;
                
                // グレースケール変換
                const grayscale = new Uint8Array(width * height);
                for (let i = 0, j = 0; i < data.length; i += 4, j++) {
                    grayscale[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                }
                
                // 簡易的なGLCM（Gray-Level Co-occurrence Matrix）の計算
                // 実際のアプリケーションではより詳細なGLCM計算が必要
                for (let y = 0; y < height - 1; y++) {
                    for (let x = 0; x < width - 1; x++) {
                        const idx = y * width + x;
                        const rightIdx = idx + 1;
                        const bottomIdx = idx + width;
                        
                        const val = grayscale[idx];
                        const rightVal = grayscale[rightIdx];
                        const bottomVal = grayscale[bottomIdx];
                        
                        // 水平方向の差分
                        const diffH = Math.abs(val - rightVal);
                        // 垂直方向の差分
                        const diffV = Math.abs(val - bottomVal);
                        
                        // コントラスト（差の二乗）
                        contrast += diffH * diffH + diffV * diffV;
                        
                        // エネルギー（値の二乗和）
                        energy += val * val;
                        
                        // 均質性
                        homogeneity += 1 / (1 + diffH) + 1 / (1 + diffV);
                    }
                }
                
                // 正規化
                const normalizer = (width - 1) * (height - 1) * 2;
                contrast /= normalizer;
                energy /= width * height;
                homogeneity /= normalizer;
                
                // エントロピー計算（ヒストグラムベース）
                const histogram = new Array(256).fill(0);
                for (let i = 0; i < grayscale.length; i++) {
                    histogram[grayscale[i]]++;
                }
                
                // 中間レベル特徴抽出関数
                async function extractMidLevelFeatures(imageElement) {
                    const canvas = document.createElement('canvas');
                    canvas.width = imageElement.naturalWidth;
                    canvas.height = imageElement.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    
                    // 画像を描画
                    ctx.drawImage(imageElement, 0, 0);
                    
                    // 画像データを取得
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    
                    // グレースケール変換
                    const grayscale = new Uint8Array(canvas.width * canvas.height);
                    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
                        grayscale[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                    }
                    
                    // 1. エッジ検出（Cannyエッジ検出の簡易版）
                    const edges = detectEdges(grayscale, canvas.width, canvas.height);
                    
                    // 2. コーナー検出（Harris Corner Detectorの簡易版）
                    const corners = detectCorners(grayscale, canvas.width, canvas.height);
                    
                    // 3. BLOB検出（簡易版）
                    const blobs = detectBlobs(grayscale, canvas.width, canvas.height);
                    
                    // 4. 線分検出（簡易版）
                    const lines = detectLines(edges, canvas.width, canvas.height);
                    
                    // セグメンテーションマスクを取得（可能な場合）
                    let mask = null;
                    try {
                        // BodyPixモデルをロード
                        const net = await bodyPix.load({
                            architecture: 'MobileNetV1',
                            outputStride: 16,
                            multiplier: 0.75,
                            quantBytes: 2
                        });
                        
                        // セグメンテーション実行
                        const segmentation = await net.segmentPerson(imageElement, {
                            flipHorizontal: false,
                            internalResolution: 'medium',
                            segmentationThreshold: 0.7
                        });
                        
                        mask = segmentation.data;
                    } catch (error) {
                        console.warn('セグメンテーション実行エラー:', error);
                        // マスクがない場合は全画素を処理対象とする
                        mask = new Uint8Array(canvas.width * canvas.height).fill(1);
                    }
                    
                    // 特徴点を抽出（エッジの交点や端点など）
                    const keyPoints = extractKeyPoints(edges, canvas.width, canvas.height, mask);
                    
                    return {
                        edges,
                        corners,
                        blobs,
                        lines,
                        keyPoints,
                        width: canvas.width,
                        height: canvas.height
                    };
                }
                
                // エッジ検出関数（改良版）
                function detectEdges(grayscale, width, height) {
                    // エッジデータを格納する配列
                    const edgeData = new Uint8ClampedArray(width * height * 4);
                    
                    // ガウシアンフィルタでノイズ除去（簡易版）
                    const smoothed = applyGaussianBlur(grayscale, width, height);
                    
                    // Sobelフィルタで勾配計算
                    const { gradientMagnitude, gradientDirection } = applySobelFilter(smoothed, width, height);
                    
                    // 非最大抑制（簡易版）
                    const nonMaxSuppressed = applyNonMaximumSuppression(gradientMagnitude, gradientDirection, width, height);
                    
                    // しきい値処理
                    const threshold = 50;
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = (y * width + x);
                            const outIdx = idx * 4;
                            
                            if (nonMaxSuppressed[idx] > threshold) {
                                edgeData[outIdx] = 255;     // R
                                edgeData[outIdx + 1] = 255; // G
                                edgeData[outIdx + 2] = 255; // B
                                edgeData[outIdx + 3] = 255; // A
                            }
                        }
                    }
                    
                    return edgeData;
                }
                
                // ガウシアンフィルタ（簡易版）
                function applyGaussianBlur(grayscale, width, height) {
                    const result = new Uint8Array(width * height);
                    const kernel = [
                        [1, 2, 1],
                        [2, 4, 2],
                        [1, 2, 1]
                    ];
                    const kernelSum = 16;
                    
                    for (let y = 1; y < height - 1; y++) {
                        for (let x = 1; x < width - 1; x++) {
                            let sum = 0;
                            
                            for (let ky = -1; ky <= 1; ky++) {
                                for (let kx = -1; kx <= 1; kx++) {
                                    const idx = (y + ky) * width + (x + kx);
                                    sum += grayscale[idx] * kernel[ky + 1][kx + 1];
                                }
                            }
                            
                            result[y * width + x] = Math.round(sum / kernelSum);
                        }
                    }
                    
                    // 境界部分をコピー
                    for (let x = 0; x < width; x++) {
                        result[x] = grayscale[x];
                        result[(height - 1) * width + x] = grayscale[(height - 1) * width + x];
                    }
                    
                    for (let y = 0; y < height; y++) {
                        result[y * width] = grayscale[y * width];
                        result[y * width + width - 1] = grayscale[y * width + width - 1];
                    }
                    
                    return result;
                }
                
                // Sobelフィルタ
                function applySobelFilter(grayscale, width, height) {
                    const gradientMagnitude = new Uint8Array(width * height);
                    const gradientDirection = new Uint8Array(width * height);
                    
                    for (let y = 1; y < height - 1; y++) {
                        for (let x = 1; x < width - 1; x++) {
                            // 周囲のピクセルとの差分を計算（エッジ検出）
                            const gx =
                                -1 * grayscale[((y-1) * width + (x-1))] +
                                -2 * grayscale[((y) * width + (x-1))] +
                                -1 * grayscale[((y+1) * width + (x-1))] +
                                1 * grayscale[((y-1) * width + (x+1))] +
                                2 * grayscale[((y) * width + (x+1))] +
                                1 * grayscale[((y+1) * width + (x+1))];
                            
                            const gy =
                                -1 * grayscale[((y-1) * width + (x-1))] +
                                -2 * grayscale[((y-1) * width + (x))] +
                                -1 * grayscale[((y-1) * width + (x+1))] +
                                1 * grayscale[((y+1) * width + (x-1))] +
                                2 * grayscale[((y+1) * width + (x))] +
                                1 * grayscale[((y+1) * width + (x+1))];
                            
                            // エッジの強さを計算
                            const g = Math.sqrt(gx * gx + gy * gy);
                            
                            // 勾配の方向を計算（0-7の8方向に量子化）
                            const angle = Math.atan2(gy, gx);
                            const direction = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
                            
                            gradientMagnitude[y * width + x] = Math.min(255, g);
                            gradientDirection[y * width + x] = direction;
                        }
                    }
                    
                    return { gradientMagnitude, gradientDirection };
                }
                
                // 非最大抑制
                function applyNonMaximumSuppression(gradientMagnitude, gradientDirection, width, height) {
                    const result = new Uint8Array(width * height);
                    
                    for (let y = 1; y < height - 1; y++) {
                        for (let x = 1; x < width - 1; x++) {
                            const idx = y * width + x;
                            const dir = gradientDirection[idx];
                            const mag = gradientMagnitude[idx];
                            
                            // 勾配方向に沿った2つの隣接ピクセルを取得
                            let neighbor1Idx, neighbor2Idx;
                            
                            switch (dir) {
                                case 0: // 0度（右）
                                case 4: // 180度（左）
                                    neighbor1Idx = idx - 1;
                                    neighbor2Idx = idx + 1;
                                    break;
                                case 1: // 45度（右上）
                                case 5: // 225度（左下）
                                    neighbor1Idx = (y - 1) * width + (x + 1);
                                    neighbor2Idx = (y + 1) * width + (x - 1);
                                    break;
                                case 2: // 90度（上）
                                case 6: // 270度（下）
                                    neighbor1Idx = (y - 1) * width + x;
                                    neighbor2Idx = (y + 1) * width + x;
                                    break;
                                case 3: // 135度（左上）
                                case 7: // 315度（右下）
                                    neighbor1Idx = (y - 1) * width + (x - 1);
                                    neighbor2Idx = (y + 1) * width + (x + 1);
                                    break;
                                default:
                                    neighbor1Idx = idx;
                                    neighbor2Idx = idx;
                            }
                            
                            // 現在のピクセルが両方の隣接ピクセルよりも大きい場合のみエッジとして残す
                            if (mag >= gradientMagnitude[neighbor1Idx] && mag >= gradientMagnitude[neighbor2Idx]) {
                                result[idx] = mag;
                            }
                        }
                    }
                    
                    return result;
                }
                
                // コーナー検出関数（Harris Corner Detector簡易版）
                function detectCorners(grayscale, width, height) {
                    const corners = [];
                    const k = 0.04; // Harrisレスポンス計算用パラメータ
                    
                    // x方向とy方向の勾配を計算
                    const dx = new Int16Array(width * height);
                    const dy = new Int16Array(width * height);
                    
                    for (let y = 1; y < height - 1; y++) {
                        for (let x = 1; x < width - 1; x++) {
                            const idx = y * width + x;
                            
                            dx[idx] = grayscale[idx + 1] - grayscale[idx - 1];
                            dy[idx] = grayscale[idx + width] - grayscale[idx - width];
                        }
                    }
                    
                    // 各ピクセルでのHarrisレスポンス計算
                    for (let y = 2; y < height - 2; y++) {
                        for (let x = 2; x < width - 2; x++) {
                            const idx = y * width + x;
                            
                            // 3x3ウィンドウ内での勾配統計量
                            let sumIx2 = 0;
                            let sumIy2 = 0;
                            let sumIxIy = 0;
                            
                            for (let wy = -1; wy <= 1; wy++) {
                                for (let wx = -1; wx <= 1; wx++) {
                                    const windowIdx = (y + wy) * width + (x + wx);
                                    sumIx2 += dx[windowIdx] * dx[windowIdx];
                                    sumIy2 += dy[windowIdx] * dy[windowIdx];
                                    sumIxIy += dx[windowIdx] * dy[windowIdx];
                                }
                            }
                            
                            // Harrisレスポンス計算: det(M) - k * trace(M)^2
                            const det = sumIx2 * sumIy2 - sumIxIy * sumIxIy;
                            const trace = sumIx2 + sumIy2;
                            const response = det - k * trace * trace;
                            
                            // しきい値以上のレスポンスをコーナーとして検出
                            if (response > 100000) {
                                corners.push({ x, y, response });
                            }
                        }
                    }
                    
                    // 非最大抑制（局所的に最大のコーナーのみを残す）
                    return applyNonMaximumSuppressionToCorners(corners, width, height);
                }
                
                // コーナーの非最大抑制
                function applyNonMaximumSuppressionToCorners(corners, width, height) {
                    const result = [];
                    const radius = 5; // 抑制する半径
                    
                    // レスポンス値でソート（降順）
                    corners.sort((a, b) => b.response - a.response);
                    
                    // 各コーナーについて
                    for (let i = 0; i < corners.length; i++) {
                        const corner = corners[i];
                        let isMaximum = true;
                        
                        // すでに選択されたコーナーと比較
                        for (let j = 0; j < result.length; j++) {
                            const selectedCorner = result[j];
                            const dx = corner.x - selectedCorner.x;
                            const dy = corner.y - selectedCorner.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            // 既存のコーナーに近い場合は抑制
                            if (distance < radius) {
                                isMaximum = false;
                                break;
                            }
                        }
                        
                        // 局所的に最大の場合のみ追加
                        if (isMaximum) {
                            result.push(corner);
                        }
                    }
                    
                    return result;
                }
                
                // BLOB検出関数（簡易版）
                function detectBlobs(grayscale, width, height) {
                    // 二値化（簡易版）
                    const threshold = 128;
                    const binary = new Uint8Array(width * height);
                    
                    for (let i = 0; i < grayscale.length; i++) {
                        binary[i] = grayscale[i] > threshold ? 1 : 0;
                    }
                    
                    // 連結成分ラベリング
                    const labels = new Int32Array(width * height).fill(-1);
                    let nextLabel = 0;
                    
                    // 第1パス：ラベル付け
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = y * width + x;
                            
                            // 背景の場合はスキップ
                            if (binary[idx] === 0) {
                                continue;
                            }
                            
                            // 上と左の隣接ピクセルを確認
                            const neighbors = [];
                            
                            if (y > 0 && binary[(y - 1) * width + x] === 1) {
                                neighbors.push(labels[(y - 1) * width + x]);
                            }
                            
                            if (x > 0 && binary[y * width + (x - 1)] === 1) {
                                neighbors.push(labels[y * width + (x - 1)]);
                            }
                            
                            if (neighbors.length === 0) {
                                // 新しいラベルを割り当て
                                labels[idx] = nextLabel++;
                            } else {
                                // 最小のラベルを割り当て
                                labels[idx] = Math.min(...neighbors);
                            }
                        }
                    }
                    
                    // BLOBの情報を収集
                    const blobs = [];
                    const labelMap = new Map();
                    
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = y * width + x;
                            const label = labels[idx];
                            
                            if (label >= 0) {
                                if (!labelMap.has(label)) {
                                    labelMap.set(label, {
                                        label,
                                        pixels: [],
                                        minX: width,
                                        minY: height,
                                        maxX: 0,
                                        maxY: 0
                                    });
                                }
                                
                                const blob = labelMap.get(label);
                                blob.pixels.push({ x, y });
                                blob.minX = Math.min(blob.minX, x);
                                blob.minY = Math.min(blob.minY, y);
                                blob.maxX = Math.max(blob.maxX, x);
                                blob.maxY = Math.max(blob.maxY, y);
                            }
                        }
                    }
                    
                    // BLOBの特徴を計算
                    for (const blob of labelMap.values()) {
                        // 面積
                        blob.area = blob.pixels.length;
                        
                        // 重心
                        let sumX = 0;
                        let sumY = 0;
                        
                        for (const pixel of blob.pixels) {
                            sumX += pixel.x;
                            sumY += pixel.y;
                        }
                        
                        blob.centerX = sumX / blob.area;
                        blob.centerY = sumY / blob.area;
                        
                        // 幅と高さ
                        blob.width = blob.maxX - blob.minX + 1;
                        blob.height = blob.maxY - blob.minY + 1;
                        
                        // アスペクト比
                        blob.aspectRatio = blob.width / blob.height;
                        
                        // 一定以上の大きさのBLOBのみを追加
                        if (blob.area > 50) {
                            blobs.push(blob);
                        }
                    }
                    
                    return blobs;
                }
                
                // 線分検出関数（簡易版）
                function detectLines(edges, width, height) {
                    // エッジデータからバイナリエッジマップを作成
                    const edgeMap = new Uint8Array(width * height);
                    
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = (y * width + x) * 4;
                            edgeMap[y * width + x] = edges[idx] > 0 ? 1 : 0;
                        }
                    }
                    
                    // 簡易的なHough変換
                    const maxRho = Math.sqrt(width * width + height * height);
                    const rhoSteps = 180;
                    const thetaSteps = 180;
                    const rhoScale = rhoSteps / (2 * maxRho);
                    const thetaScale = thetaSteps / Math.PI;
                    
                    // 累積配列
                    const accumulator = new Uint32Array(rhoSteps * thetaSteps);
                    
                    // エッジ点をHough空間に変換
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            if (edgeMap[y * width + x] === 1) {
                                for (let t = 0; t < thetaSteps; t++) {
                                    const theta = t / thetaScale;
                                    const rho = x * Math.cos(theta) + y * Math.sin(theta);
                                    const rhoIdx = Math.floor((rho + maxRho) * rhoScale);
                                    
                                    if (rhoIdx >= 0 && rhoIdx < rhoSteps) {
                                        accumulator[rhoIdx * thetaSteps + t]++;
                                    }
                                }
                            }
                        }
                    }
                    
                    // 局所的な最大値を検出
                    const lines = [];
                    const threshold = 50; // 線分検出のしきい値
                    
                    for (let r = 1; r < rhoSteps - 1; r++) {
                        for (let t = 1; t < thetaSteps - 1; t++) {
                            const idx = r * thetaSteps + t;
                            const value = accumulator[idx];
                            
                            if (value > threshold) {
                                // 局所的な最大値かどうかチェック
                                let isLocalMax = true;
                                
                                for (let dr = -1; dr <= 1 && isLocalMax; dr++) {
                                    for (let dt = -1; dt <= 1 && isLocalMax; dt++) {
                                        if (dr !== 0 || dt !== 0) {
                                            const neighborIdx = (r + dr) * thetaSteps + (t + dt);
                                            if (accumulator[neighborIdx] > value) {
                                                isLocalMax = false;
                                            }
                                        }
                                    }
                                }
                                
                                if (isLocalMax) {
                                    const theta = t / thetaScale;
                                    const rho = (r / rhoScale) - maxRho;
                                    
                                    // 線分の端点を計算
                                    let x1, y1, x2, y2;
                                    
                                    if (Math.abs(Math.sin(theta)) < 0.001) {
                                        // 垂直線
                                        x1 = x2 = Math.round(rho);
                                        y1 = 0;
                                        y2 = height - 1;
                                    } else if (Math.abs(Math.cos(theta)) < 0.001) {
                                        // 水平線
                                        x1 = 0;
                                        x2 = width - 1;
                                        y1 = y2 = Math.round(rho);
                                    } else {
                                        // 斜め線
                                        x1 = 0;
                                        y1 = Math.round(rho / Math.sin(theta));
                                        x2 = width - 1;
                                        y2 = Math.round((rho - x2 * Math.cos(theta)) / Math.sin(theta));
                                        
                                        // 画像の範囲外の場合は調整
                                        if (y1 < 0 || y1 >= height) {
                                            if (y1 < 0) {
                                                x1 = Math.round((rho - 0 * Math.sin(theta)) / Math.cos(theta));
                                                y1 = 0;
                                            } else {
                                                x1 = Math.round((rho - (height - 1) * Math.sin(theta)) / Math.cos(theta));
                                                y1 = height - 1;
                                            }
                                        }
                                        
                                        if (y2 < 0 || y2 >= height) {
                                            if (y2 < 0) {
                                                x2 = Math.round((rho - 0 * Math.sin(theta)) / Math.cos(theta));
                                                y2 = 0;
                                            } else {
                                                x2 = Math.round((rho - (height - 1) * Math.sin(theta)) / Math.cos(theta));
                                                y2 = height - 1;
                                            }
                                        }
                                    }
                                    
                                    // 有効な線分のみを追加
                                    if (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height &&
                                        x2 >= 0 && x2 < width && y2 >= 0 && y2 < height) {
                                        lines.push({
                                            x1, y1, x2, y2,
                                            theta,
                                            rho,
                                            strength: value
                                        });
                                    }
                                }
                            }
                        }
                    }
                    
                    // 強度でソート
                    lines.sort((a, b) => b.strength - a.strength);
                    
                    // 上位の線分のみを返す
                    return lines.slice(0, 20);
                }
                
                // 高レベル特徴抽出関数
                function extractHighLevelFeatures(midLevelFeatures) {
                    // 形状特徴
                    const shapeFeatures = extractShapeFeatures(midLevelFeatures);
                    
                    // パターン特徴
                    const patternFeatures = extractPatternFeatures(midLevelFeatures);
                    
                    // 空間配置特徴
                    const spatialFeatures = extractSpatialFeatures(midLevelFeatures);
                    
                    return {
                        shapes: shapeFeatures,
                        patterns: patternFeatures,
                        spatial: spatialFeatures
                    };
                }
                
                // 形状特徴抽出
                function extractShapeFeatures(midLevelFeatures) {
                    const { edges, corners, blobs, lines, keyPoints, width, height } = midLevelFeatures;
                    
                    // 形状の基本特性
                    const shapeDescriptors = {
                        cornerCount: corners ? corners.length : 0,
                        lineCount: lines ? lines.length : 0,
                        blobCount: blobs ? blobs.length : 0,
                        keyPointCount: keyPoints ? keyPoints.length : 0
                    };
                    
                    // BLOBの形状分析
                    const blobShapes = blobs ? blobs.map(blob => {
                        // 円形度（circularity）
                        const perimeter = 2 * Math.PI * Math.sqrt((blob.width * blob.width + blob.height * blob.height) / 8);
                        const circularity = (4 * Math.PI * blob.area) / (perimeter * perimeter);
                        
                        // アスペクト比
                        const aspectRatio = blob.width / blob.height;
                        
                        return {
                            area: blob.area,
                            perimeter,
                            circularity,
                            aspectRatio,
                            centerX: blob.centerX,
                            centerY: blob.centerY
                        };
                    }) : [];
                    
                    // 線分の方向分布
                    const lineDirections = new Array(8).fill(0);
                    
                    if (lines) {
                        for (const line of lines) {
                            const angle = line.theta;
                            const directionIndex = Math.floor(angle / (Math.PI / 8)) % 8;
                            lineDirections[directionIndex]++;
                        }
                    }
                    
                    // 形状の複雑さ指標
                    const complexity = calculateShapeComplexity(midLevelFeatures);
                    
                    return {
                        basic: shapeDescriptors,
                        blobs: blobShapes,
                        lineDirections,
                        complexity
                    };
                }
                
                // 形状の複雑さを計算
                function calculateShapeComplexity(midLevelFeatures) {
                    const { corners, lines, keyPoints, width, height } = midLevelFeatures;
                    
                    // 特徴点の密度
                    const keyPointDensity = keyPoints && keyPoints.length > 0 ? keyPoints.length / (width * height) : 0;
                    
                    // コーナーと線分の比率
                    const cornerToLineRatio = corners && corners.length > 0 && lines ? lines.length / corners.length : 0;
                    
                    // 複雑さスコア（0-1の範囲に正規化）
                    const complexityScore = Math.min(1, (keyPointDensity * 10000 + cornerToLineRatio) / 10);
                    
                    return {
                        keyPointDensity,
                        cornerToLineRatio,
                        complexityScore
                    };
                }
                
                // パターン特徴抽出
                function extractPatternFeatures(midLevelFeatures) {
                    const { lines, keyPoints, width, height } = midLevelFeatures;
                    
                    // 線の方向ヒストグラム
                    const lineDirectionHistogram = lines ? calculateLineDirectionHistogram(lines) : new Array(8).fill(0);
                    
                    // 線の長さヒストグラム
                    const lineLengthHistogram = lines ? calculateLineLengthHistogram(lines) : new Array(10).fill(0);
                    
                    // 特徴点の分布パターン
                    const keyPointDistribution = keyPoints ? analyzeKeyPointDistribution(keyPoints, width, height) : {
                        horizontalDensity: new Array(10).fill(0),
                        verticalDensity: new Array(10).fill(0),
                        quadrantDensity: [0, 0, 0, 0],
                        centerOfMass: { x: 0.5, y: 0.5 }
                    };
                    
                    // 対称性の検出
                    const symmetry = keyPoints ? detectSymmetry(keyPoints, width, height) : {
                        horizontalSymmetry: 0,
                        verticalSymmetry: 0,
                        diagonalSymmetry: 0
                    };
                    
                    return {
                        lineDirections: lineDirectionHistogram,
                        lineLengths: lineLengthHistogram,
                        keyPointDistribution,
                        symmetry
                    };
                }
                
                // 線の方向ヒストグラムを計算
                function calculateLineDirectionHistogram(lines) {
                    const histogram = new Array(8).fill(0);
                    
                    for (const line of lines) {
                        const angle = line.theta;
                        const directionIndex = Math.floor(angle / (Math.PI / 8)) % 8;
                        histogram[directionIndex] += line.strength;
                    }
                    
                    // 正規化
                    const sum = histogram.reduce((a, b) => a + b, 0);
                    return sum > 0 ? histogram.map(v => v / sum) : histogram;
                }
                
                // 線の長さヒストグラムを計算
                function calculateLineLengthHistogram(lines) {
                    const histogram = new Array(10).fill(0);
                    
                    for (const line of lines) {
                        const dx = line.x2 - line.x1;
                        const dy = line.y2 - line.y1;
                        const length = Math.sqrt(dx * dx + dy * dy);
                        
                        // 長さを10段階に量子化
                        const lengthIndex = Math.min(9, Math.floor(length / 50));
                        histogram[lengthIndex]++;
                    }
                    
                    // 正規化
                    const sum = histogram.reduce((a, b) => a + b, 0);
                    return sum > 0 ? histogram.map(v => v / sum) : histogram;
                }
                
                // 特徴点の分布パターンを分析
                function analyzeKeyPointDistribution(keyPoints, width, height) {
                    if (keyPoints.length === 0) {
                        return {
                            horizontalDensity: new Array(10).fill(0),
                            verticalDensity: new Array(10).fill(0),
                            quadrantDensity: [0, 0, 0, 0],
                            centerOfMass: { x: 0.5, y: 0.5 }
                        };
                    }
                    
                    // 水平方向の密度分布
                    const horizontalDensity = new Array(10).fill(0);
                    
                    // 垂直方向の密度分布
                    const verticalDensity = new Array(10).fill(0);
                    
                    // 4象限の密度分布
                    const quadrantDensity = [0, 0, 0, 0];
                    
                    // 重心計算
                    let sumX = 0;
                    let sumY = 0;
                    
                    for (const point of keyPoints) {
                        // 水平方向の密度
                        const xBin = Math.min(9, Math.floor(point.x / width * 10));
                        horizontalDensity[xBin]++;
                        
                        // 垂直方向の密度
                        const yBin = Math.min(9, Math.floor(point.y / height * 10));
                        verticalDensity[yBin]++;
                        
                        // 象限の密度
                        const quadrant = (point.x < width / 2 ? 0 : 1) + (point.y < height / 2 ? 0 : 2);
                        quadrantDensity[quadrant]++;
                        
                        // 重心計算
                        sumX += point.x;
                        sumY += point.y;
                    }
                    
                    // 正規化
                    const normalizeArray = arr => {
                        const sum = arr.reduce((a, b) => a + b, 0);
                        return sum > 0 ? arr.map(v => v / sum) : arr;
                    };
                    
                    return {
                        horizontalDensity: normalizeArray(horizontalDensity),
                        verticalDensity: normalizeArray(verticalDensity),
                        quadrantDensity: normalizeArray(quadrantDensity),
                        centerOfMass: {
                            x: sumX / keyPoints.length / width,
                            y: sumY / keyPoints.length / height
                        }
                    };
                }
                
                // 対称性を検出
                function detectSymmetry(keyPoints, width, height) {
                    if (keyPoints.length === 0) {
                        return {
                            horizontalSymmetry: 0,
                            verticalSymmetry: 0,
                            diagonalSymmetry: 0
                        };
                    }
                    
                    // 水平対称性
                    let horizontalSymmetry = 0;
                    
                    // 垂直対称性
                    let verticalSymmetry = 0;
                    
                    // 対角対称性
                    let diagonalSymmetry = 0;
                    
                    // 中心点
                    const centerX = width / 2;
                    const centerY = height / 2;
                    
                    // 各特徴点について対称性を計算
                    for (const point of keyPoints) {
                        // 水平対称点
                        const horizontalReflectionX = point.x;
                        const horizontalReflectionY = 2 * centerY - point.y;
                        
                        // 垂直対称点
                        const verticalReflectionX = 2 * centerX - point.x;
                        const verticalReflectionY = point.y;
                        
                        // 対角対称点
                        const diagonalReflectionX = 2 * centerX - point.x;
                        const diagonalReflectionY = 2 * centerY - point.y;
                        
                        // 各対称点に近い特徴点があるかチェック
                        let minHorizontalDistance = Infinity;
                        let minVerticalDistance = Infinity;
                        let minDiagonalDistance = Infinity;
                        
                        for (const otherPoint of keyPoints) {
                            // 水平対称性
                            const horizontalDistance = Math.sqrt(
                                Math.pow(otherPoint.x - horizontalReflectionX, 2) +
                                Math.pow(otherPoint.y - horizontalReflectionY, 2)
                            );
                            
                            // 垂直対称性
                            const verticalDistance = Math.sqrt(
                                Math.pow(otherPoint.x - verticalReflectionX, 2) +
                                Math.pow(otherPoint.y - verticalReflectionY, 2)
                            );
                            
                            // 対角対称性
                            const diagonalDistance = Math.sqrt(
                                Math.pow(otherPoint.x - diagonalReflectionX, 2) +
                                Math.pow(otherPoint.y - diagonalReflectionY, 2)
                            );
                            
                            minHorizontalDistance = Math.min(minHorizontalDistance, horizontalDistance);
                            minVerticalDistance = Math.min(minVerticalDistance, verticalDistance);
                            minDiagonalDistance = Math.min(minDiagonalDistance, diagonalDistance);
                        }
                        
                        // 対称性スコアに寄与（距離が小さいほど対称性が高い）
                        const maxDistance = Math.sqrt(width * width + height * height);
                        horizontalSymmetry += 1 - Math.min(1, minHorizontalDistance / (maxDistance * 0.1));
                        verticalSymmetry += 1 - Math.min(1, minVerticalDistance / (maxDistance * 0.1));
                        diagonalSymmetry += 1 - Math.min(1, minDiagonalDistance / (maxDistance * 0.1));
                    }
                    
                    // 正規化
                    horizontalSymmetry /= keyPoints.length;
                    verticalSymmetry /= keyPoints.length;
                    diagonalSymmetry /= keyPoints.length;
                    
                    return {
                        horizontalSymmetry,
                        verticalSymmetry,
                        diagonalSymmetry
                    };
                }
                
                // 空間配置特徴抽出
                function extractSpatialFeatures(midLevelFeatures) {
                    const { keyPoints, width, height } = midLevelFeatures;
                    
                    if (!keyPoints || keyPoints.length === 0) {
                        return {
                            distribution: {
                                topHalf: 0.5,
                                bottomHalf: 0.5,
                                leftHalf: 0.5,
                                rightHalf: 0.5,
                                center: 0.5,
                                periphery: 0.5
                            },
                            complexity: {
                                averageDistance: 0,
                                standardDeviation: 0,
                                entropy: 0
                            }
                        };
                    }
                    
                    // 特徴点の空間分布
                    const spatialDistribution = {
                        topHalf: 0,
                        bottomHalf: 0,
                        leftHalf: 0,
                        rightHalf: 0,
                        center: 0,
                        periphery: 0
                    };
                    
                    // 中心と周辺の定義
                    const centerX = width / 2;
                    const centerY = height / 2;
                    const centerRadius = Math.min(width, height) / 4;
                    
                    for (const point of keyPoints) {
                        // 上下左右の分布
                        if (point.y < height / 2) spatialDistribution.topHalf++;
                        else spatialDistribution.bottomHalf++;
                        
                        if (point.x < width / 2) spatialDistribution.leftHalf++;
                        else spatialDistribution.rightHalf++;
                        
                        // 中心と周辺の分布
                        const distanceToCenter = Math.sqrt(
                            Math.pow(point.x - centerX, 2) +
                            Math.pow(point.y - centerY, 2)
                        );
                        
                        if (distanceToCenter < centerRadius) spatialDistribution.center++;
                        else spatialDistribution.periphery++;
                    }
                    
                    // 正規化
                    const total = keyPoints.length;
                    if (total > 0) {
                        for (const key in spatialDistribution) {
                            spatialDistribution[key] /= total;
                        }
                    }
                    
                    // 空間的な複雑さ
                    const spatialComplexity = calculateSpatialComplexity(keyPoints, width, height);
                    
                    return {
                        distribution: spatialDistribution,
                        complexity: spatialComplexity
                    };
                }
                
                // 空間的な複雑さを計算
                function calculateSpatialComplexity(keyPoints, width, height) {
                    if (keyPoints.length < 2) {
                        return {
                            averageDistance: 0,
                            standardDeviation: 0,
                            entropy: 0
                        };
                    }
                    
                    // 点間の平均距離
                    let totalDistance = 0;
                    let count = 0;
                    
                    for (let i = 0; i < keyPoints.length; i++) {
                        for (let j = i + 1; j < keyPoints.length; j++) {
                            const dx = keyPoints[i].x - keyPoints[j].x;
                            const dy = keyPoints[i].y - keyPoints[j].y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            totalDistance += distance;
                            count++;
                        }
                    }
                    
                    const averageDistance = count > 0 ? totalDistance / count : 0;
                    
                    // 距離の標準偏差
                    let sumSquaredDiff = 0;
                    
                    for (let i = 0; i < keyPoints.length; i++) {
                        for (let j = i + 1; j < keyPoints.length; j++) {
                            const dx = keyPoints[i].x - keyPoints[j].x;
                            const dy = keyPoints[i].y - keyPoints[j].y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            const diff = distance - averageDistance;
                            sumSquaredDiff += diff * diff;
                        }
                    }
                    
                    const standardDeviation = count > 0 ? Math.sqrt(sumSquaredDiff / count) : 0;
                    
                    // 空間的エントロピー（簡易版）
                    const gridSize = 10;
                    const grid = new Array(gridSize * gridSize).fill(0);
                    
                    for (const point of keyPoints) {
                        const xBin = Math.min(gridSize - 1, Math.floor(point.x / width * gridSize));
                        const yBin = Math.min(gridSize - 1, Math.floor(point.y / height * gridSize));
                        grid[yBin * gridSize + xBin]++;
                    }
                    
                    let entropy = 0;
                    for (const count of grid) {
                        const p = count / keyPoints.length;
                        if (p > 0) {
                            entropy -= p * Math.log2(p);
                        }
                    }
                    
                    // 正規化（最大エントロピーは log2(gridSize^2)）
                    entropy /= Math.log2(gridSize * gridSize);
                    
                    return {
                        averageDistance,
                        standardDeviation,
                        entropy
                    };
                }
                
                for (let i = 0; i < 256; i++) {
                    const p = histogram[i] / grayscale.length;
                    if (p > 0) {
                        entropy -= p * Math.log2(p);
                    }
                }
                
                return { contrast, energy, homogeneity, entropy };
            }
        }
        
        // 密度が低い文字（C, L, 7など）
        if (patterns.density < 0.005) {
            if (['C', 'L', '7', '/', '\\', 'く', 'へ', '人', '入'].includes(char)) {
                score += 2;
            }
        }
        
        return { char, score };
    });
    
    // スコアの高い順にソート
    scores.sort((a, b) => b.score - a.score);
    
    // 最もスコアの高い文字を返す
    return scores[0].char;
}

// 生成された文字を表示
function displayGeneratedCharacter(character) {
    const generatedCharElement = document.getElementById('generatedChar');
    generatedCharElement.textContent = character;
}

// 意味的特徴抽出関数
async function extractSemanticFeatures(imageElement) {
    try {
        // BodyPixモデルをロード
        const net = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        
        // セグメンテーション実行
        const segmentation = await net.segmentPerson(imageElement, {
            flipHorizontal: false,
            internalResolution: 'medium',
            segmentationThreshold: 0.7
        });
        
        // 人物の部位ごとのセグメンテーション（可能な場合）
        let partSegmentation = null;
        try {
            partSegmentation = await net.segmentPersonParts(imageElement, {
                flipHorizontal: false,
                internalResolution: 'medium',
                segmentationThreshold: 0.7
            });
        } catch (error) {
            console.warn('部位セグメンテーションに失敗しました:', error);
        }
        
        // セグメンテーション結果の分析
        const segmentationAnalysis = analyzeSegmentation(segmentation, imageElement.naturalWidth, imageElement.naturalHeight);
        
        // 部位セグメンテーション結果の分析（可能な場合）
        const partAnalysis = partSegmentation ?
            analyzePartSegmentation(partSegmentation) : null;
        
        return {
            personSegmentation: segmentationAnalysis,
            bodyParts: partAnalysis
        };
    } catch (error) {
        console.warn('意味的特徴抽出に失敗しました:', error);
        return {
            personSegmentation: null,
            bodyParts: null
        };
    }
}

// セグメンテーション結果の分析
function analyzeSegmentation(segmentation, width, height) {
    const mask = segmentation.data;
    
    // 人物領域のピクセル数
    let personPixels = 0;
    
    // 人物領域の境界ボックス
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            
            if (mask[idx]) {
                personPixels++;
                
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    // 人物が検出されなかった場合
    if (personPixels === 0) {
        return {
            detected: false,
            coverage: 0,
            aspectRatio: 0,
            boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
        };
    }
    
    // 人物領域の割合
    const coverage = personPixels / (width * height);
    
    // 人物領域のアスペクト比
    const boundingWidth = maxX - minX + 1;
    const boundingHeight = maxY - minY + 1;
    const aspectRatio = boundingWidth / boundingHeight;
    
    return {
        detected: true,
        coverage,
        aspectRatio,
        boundingBox: {
            minX,
            minY,
            maxX,
            maxY,
            width: boundingWidth,
            height: boundingHeight
        }
    };
}

// 部位セグメンテーション結果の分析
function analyzePartSegmentation(partSegmentation) {
    if (!partSegmentation.allPoses || partSegmentation.allPoses.length === 0) {
        return {
            partCount: 0,
            parts: []
        };
    }
    
    // 特徴の統合と分析関数
    function integrateAndAnalyzeFeatures(features) {
        // 各レベルの特徴を統合
        const integratedFeatures = {
            // 元の特徴を保持
            original: features,
            
            // 統合された特徴ベクトル
            vector: createFeatureVector(features),
            
            // 特徴の重要度スコア
            importance: calculateFeatureImportance(features),
            
            // 特徴に基づく文字生成のためのパターン
            characterPatterns: extractCharacterPatterns(features)
        };
        
        return integratedFeatures;
    }
    
    // 特徴ベクトルの作成
    function createFeatureVector(features) {
        const vector = [];
        
        // 低レベル特徴からの寄与
        if (features.lowLevel) {
            // 色ヒストグラムの代表値
            const colorFeatures = [];
            
            if (features.lowLevel.histograms) {
                // 各チャンネルのピーク値
                const findPeaks = hist => {
                    const peaks = [];
                    for (let i = 1; i < hist.length - 1; i++) {
                        if (hist[i] > hist[i - 1] && hist[i] > hist[i + 1] && hist[i] > 0.01) {
                            peaks.push({ value: i, strength: hist[i] });
                        }
                    }
                    return peaks.sort((a, b) => b.strength - a.strength).slice(0, 3);
                };
                
                const rPeaks = findPeaks(features.lowLevel.histograms.r);
                const gPeaks = findPeaks(features.lowLevel.histograms.g);
                const bPeaks = findPeaks(features.lowLevel.histograms.b);
                
                colorFeatures.push(...rPeaks.map(p => p.strength));
                colorFeatures.push(...gPeaks.map(p => p.strength));
                colorFeatures.push(...bPeaks.map(p => p.strength));
            }
            
            // HSV分布の代表値
            if (features.lowLevel.hsvDistribution) {
                const hueVariance = calculateVariance(features.lowLevel.hsvDistribution.hue);
                const saturationMean = calculateMean(features.lowLevel.hsvDistribution.saturation);
                const valueMean = calculateMean(features.lowLevel.hsvDistribution.value);
                
                colorFeatures.push(hueVariance, saturationMean, valueMean);
            }
            
            // テクスチャ特徴
            if (features.lowLevel.textureFeatures) {
                const { contrast, energy, homogeneity, entropy } = features.lowLevel.textureFeatures;
                colorFeatures.push(contrast, energy, homogeneity, entropy);
            }
            
            vector.push(...colorFeatures);
        }
        
        // 中間レベル特徴からの寄与
        if (features.midLevel) {
            const midLevelFeatures = [];
            
            // キーポイントの数
            if (features.midLevel.keyPoints) {
                midLevelFeatures.push(features.midLevel.keyPoints.length / 100); // 正規化
            }
            
            // コーナーの数
            if (features.midLevel.corners) {
                midLevelFeatures.push(features.midLevel.corners.length / 50); // 正規化
            }
            
            // 線分の数
            if (features.midLevel.lines) {
                midLevelFeatures.push(features.midLevel.lines.length / 20); // 正規化
            }
            
            vector.push(...midLevelFeatures);
        }
        
        // 高レベル特徴からの寄与
        if (features.highLevel) {
            const highLevelFeatures = [];
            
            // 形状特徴
            if (features.highLevel.shapes) {
                // 複雑さスコア
                if (features.highLevel.shapes.complexity) {
                    highLevelFeatures.push(features.highLevel.shapes.complexity.complexityScore);
                }
                
                // 線の方向分布
                if (features.highLevel.shapes.lineDirections) {
                    // 水平線と垂直線の比率
                    const horizontal = features.highLevel.shapes.lineDirections[0] + features.highLevel.shapes.lineDirections[4];
                    const vertical = features.highLevel.shapes.lineDirections[2] + features.highLevel.shapes.lineDirections[6];
                    highLevelFeatures.push(horizontal / (vertical + 0.001));
                }
            }
            
            // パターン特徴
            if (features.highLevel.patterns) {
                // 対称性
                if (features.highLevel.patterns.symmetry) {
                    const { horizontalSymmetry, verticalSymmetry, diagonalSymmetry } = features.highLevel.patterns.symmetry;
                    highLevelFeatures.push(horizontalSymmetry, verticalSymmetry, diagonalSymmetry);
                }
                
                // 特徴点分布
                if (features.highLevel.patterns.keyPointDistribution) {
                    const { centerOfMass } = features.highLevel.patterns.keyPointDistribution;
                    highLevelFeatures.push(centerOfMass.x, centerOfMass.y);
                }
            }
            
            // 空間配置特徴
            if (features.highLevel.spatial) {
                // 分布
                if (features.highLevel.spatial.distribution) {
                    const { topHalf, leftHalf, center } = features.highLevel.spatial.distribution;
                    highLevelFeatures.push(topHalf, leftHalf, center);
                }
                
                // 複雑さ
                if (features.highLevel.spatial.complexity) {
                    const { entropy } = features.highLevel.spatial.complexity;
                    highLevelFeatures.push(entropy);
                }
            }
            
            vector.push(...highLevelFeatures);
        }
        
        // 意味的特徴からの寄与
        if (features.semantic && features.semantic.personSegmentation) {
            const semanticFeatures = [];
            
            const { detected, coverage, aspectRatio } = features.semantic.personSegmentation;
            semanticFeatures.push(detected ? 1 : 0, coverage, aspectRatio);
            
            vector.push(...semanticFeatures);
        }
        
        return vector;
    }
    
    // 配列の平均値を計算
    function calculateMean(array) {
        return array.reduce((sum, value) => sum + value, 0) / array.length;
    }
    
    // 配列の分散を計算
    function calculateVariance(array) {
        const mean = calculateMean(array);
        return array.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / array.length;
    }
    
    // 特徴の重要度を計算
    function calculateFeatureImportance(features) {
        // 各特徴カテゴリの重要度スコア
        const importance = {
            color: 0,
            texture: 0,
            edges: 0,
            corners: 0,
            shapes: 0,
            symmetry: 0,
            spatial: 0,
            semantic: 0
        };
        
        // 色の重要度
        if (features.lowLevel && features.lowLevel.dominantColors) {
            // 主要な色の数と強さに基づいて重要度を計算
            importance.color = Math.min(1, features.lowLevel.dominantColors.length * 0.2);
        }
        
        // テクスチャの重要度
        if (features.lowLevel && features.lowLevel.textureFeatures) {
            const { contrast, entropy } = features.lowLevel.textureFeatures;
            importance.texture = Math.min(1, (contrast + entropy) / 2);
        }
        
        // エッジの重要度
        if (features.midLevel && features.midLevel.edges) {
            // エッジの強さに基づいて重要度を計算
            let edgeStrength = 0;
            const edges = features.midLevel.edges;
            for (let i = 0; i < edges.length; i += 4) {
                if (edges[i] > 0) edgeStrength++;
            }
            importance.edges = Math.min(1, edgeStrength / (features.midLevel.width * features.midLevel.height) * 10);
        }
        
        // コーナーの重要度
        if (features.midLevel && features.midLevel.corners) {
            importance.corners = Math.min(1, features.midLevel.corners.length / 50);
        }
        
        // 形状の重要度
        if (features.highLevel && features.highLevel.shapes) {
            importance.shapes = Math.min(1, features.highLevel.shapes.complexity.complexityScore);
        }
        
        // 対称性の重要度
        if (features.highLevel && features.highLevel.patterns && features.highLevel.patterns.symmetry) {
            const { horizontalSymmetry, verticalSymmetry } = features.highLevel.patterns.symmetry;
            importance.symmetry = Math.max(horizontalSymmetry, verticalSymmetry);
        }
        
        // 空間配置の重要度
        if (features.highLevel && features.highLevel.spatial) {
            importance.spatial = Math.min(1, features.highLevel.spatial.complexity.entropy);
        }
        
        // 意味的特徴の重要度
        if (features.semantic && features.semantic.personSegmentation) {
            importance.semantic = features.semantic.personSegmentation.detected ?
                Math.min(1, features.semantic.personSegmentation.coverage * 2) : 0;
        }
        
        return importance;
    }
    
    // 文字生成のためのパターン抽出
    function extractCharacterPatterns(features) {
        // 文字の特性を表すパターン
        const patterns = {
            horizontalLines: 0,
            verticalLines: 0,
            diagonalLines: 0,
            curves: 0,
            symmetryX: 0,
            symmetryY: 0,
            aspectRatio: 1,
            complexity: 0,
            density: 0
        };
        
        // 線の方向性
        if (features.highLevel && features.highLevel.shapes && features.highLevel.shapes.lineDirections) {
            const lineDirections = features.highLevel.shapes.lineDirections;
            
            // 水平線（0度と180度）
            patterns.horizontalLines = lineDirections[0] + lineDirections[4];
            
            // 垂直線（90度と270度）
            patterns.verticalLines = lineDirections[2] + lineDirections[6];
            
            // 対角線（45度、135度、225度、315度）
            patterns.diagonalLines = lineDirections[1] + lineDirections[3] + lineDirections[5] + lineDirections[7];
        }
        
        // 曲線性（コーナーの数から推定）
        if (features.midLevel && features.midLevel.corners) {
            patterns.curves = Math.min(1, features.midLevel.corners.length / 20);
        }
        
        // 対称性
        if (features.highLevel && features.highLevel.patterns && features.highLevel.patterns.symmetry) {
            patterns.symmetryX = features.highLevel.patterns.symmetry.horizontalSymmetry;
            patterns.symmetryY = features.highLevel.patterns.symmetry.verticalSymmetry;
        }
        
        // アスペクト比
        if (features.highLevel && features.highLevel.shapes && features.highLevel.shapes.blobs && features.highLevel.shapes.blobs.length > 0) {
            // 最大のBLOBのアスペクト比を使用
            const largestBlob = features.highLevel.shapes.blobs.reduce(
                (max, blob) => blob.area > max.area ? blob : max,
                { area: 0, aspectRatio: 1 }
            );
            patterns.aspectRatio = largestBlob.aspectRatio;
        } else if (features.semantic && features.semantic.personSegmentation && features.semantic.personSegmentation.detected) {
            // 人物領域のアスペクト比を使用
            patterns.aspectRatio = features.semantic.personSegmentation.aspectRatio;
        }
        
        // 複雑さ
        if (features.highLevel && features.highLevel.shapes && features.highLevel.shapes.complexity) {
            patterns.complexity = features.highLevel.shapes.complexity.complexityScore;
        }
        
        // 密度
        if (features.midLevel && features.midLevel.keyPoints && features.midLevel.width && features.midLevel.height) {
            patterns.density = features.midLevel.keyPoints.length / (features.midLevel.width * features.midLevel.height);
        }
        
        return patterns;
    }
    
    const parts = partSegmentation.allPoses.reduce((acc, pose) => {
        // 各キーポイントの情報を抽出
        const keypoints = pose.keypoints.map(kp => ({
            part: kp.part,
            position: { x: kp.position.x, y: kp.position.y },
            score: kp.score
        }));
        
        // スコアが高いキーポイントのみを使用
        const validKeypoints = keypoints.filter(kp => kp.score > 0.5);
        
        // 各部位の相対的な位置関係を分析
        const relationships = [];
        
        for (let i = 0; i < validKeypoints.length; i++) {
            for (let j = i + 1; j < validKeypoints.length; j++) {
                const kp1 = validKeypoints[i];
                const kp2 = validKeypoints[j];
                
                const dx = kp2.position.x - kp1.position.x;
                const dy = kp2.position.y - kp1.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                relationships.push({
                    parts: [kp1.part, kp2.part],
                    distance,
                    angle
                });
            }
        }
        
        acc.push({
            keypoints: validKeypoints,
            relationships
        });
        
        return acc;
    }, []);
    
    return {
        partCount: parts.length,
        parts
    };
}