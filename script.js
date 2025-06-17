document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const imageUpload = document.getElementById('imageUpload');
    const dropArea = document.getElementById('dropArea');
    const processButton = document.getElementById('processButton');
    const originalImage = document.getElementById('originalImage');
    const originalImageContainer = document.getElementById('originalImageContainer');
    const featureCanvas = document.getElementById('featureCanvas');
    const generatedChar = document.getElementById('generatedChar');
    
    let uploadedImage = null;
    
    // ファイル選択イベント
    imageUpload.addEventListener('change', handleFileSelect);
    
    // ドラッグ&ドロップイベント
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('highlight');
    });
    
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('highlight');
    });
    
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('highlight');
        
        if (e.dataTransfer.files.length) {
            imageUpload.files = e.dataTransfer.files;
            handleFileSelect(e);
        }
    });
    
    // 処理ボタンのクリックイベント
    processButton.addEventListener('click', async () => {
        if (uploadedImage) {
            processButton.disabled = true;
            processButton.textContent = '処理中...';
            
            try {
                // 画像処理関数を呼び出し
                await processImage(uploadedImage);
            } catch (error) {
                console.error('画像処理エラー:', error);
                alert('画像の処理中にエラーが発生しました。');
            } finally {
                processButton.textContent = '画像を処理';
                processButton.disabled = false;
            }
        }
    });
    
    // ファイル選択処理
    function handleFileSelect(event) {
        const files = event.target.files || event.dataTransfer.files;
        
        if (files.length === 0) return;
        
        const file = files[0];
        
        // 画像ファイルかどうかチェック
        if (!file.type.match('image.*')) {
            alert('画像ファイルを選択してください。');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            // 画像をロード
            originalImage.onload = () => {
                // 画像のロードが完了したら処理ボタンを有効化
                uploadedImage = originalImage;
                processButton.disabled = false;
                
                // 画像を表示
                originalImage.style.display = 'block';
            };
            
            originalImage.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    }
});