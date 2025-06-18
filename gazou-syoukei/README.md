# 画像から象形文字ジェネレーター

画像を解析し、ChatGPT APIを使用して象形文字風のイラストと説明を生成するPythonアプリケーションです。

## 機能

- 画像の輪郭を抽出して象形文字風に変換
- ChatGPT APIを使用して象形文字の説明を自動生成
- GUIで簡単に操作可能
- 変換結果をPNG形式で保存

## 必要な環境

- Python 3.9以上
- tkinterサポート付きのPython

## インストール方法

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/gazou-syoukei.git
cd gazou-syoukei
```

### 2. 依存ライブラリのインストール

```bash
pip install -r requirements.txt
```

または個別にインストール：

```bash
pip install opencv-python pillow numpy openai
```

## OpenAI APIキーの設定

このアプリケーションはChatGPT APIを使用するため、OpenAI APIキーが必要です。

1. [OpenAI](https://platform.openai.com/api-keys)でAPIキーを取得
2. `main.py`を開き、ファイルの先頭にある`OPENAI_API_KEY`に取得したAPIキーを設定
   ```python
   OPENAI_API_KEY = "your-api-key-here"  # ここに実際のAPIキーを入力
   ```
3. ファイルを保存してアプリケーションを実行

## 実行方法

### 方法1: 通常のPython環境（推奨）

```bash
python3 main.py
```

### 方法2: tkinterエラーが出る場合

macOSでtkinterが使えない場合は、システムのPythonを使用：

```bash
/usr/bin/python3 main.py
```

### 方法3: Homebrewでtkinter対応のPythonをインストール

```bash
# Python 3.11の場合
brew install python-tk@3.11

# その後、通常通り実行
python3 main.py
```

## 使い方

1. `main.py`の9行目にあるAPIキーを設定：
   ```python
   OPENAI_API_KEY = "sk-your-actual-api-key-here"
   ```
2. アプリケーションを起動
3. 「画像を選択」ボタンをクリックして変換したい画像を選択
4. 「象形文字に変換」ボタンをクリック
5. 変換結果が右側に表示される
6. 「画像を保存」ボタンで結果を保存

## トラブルシューティング

### tkinterエラーが出る場合

```
ModuleNotFoundError: No module named '_tkinter'
```

このエラーが出る場合は、上記の「方法2」または「方法3」を試してください。

### OpenCVやPillowがインストールできない場合

```bash
# pipをアップグレード
pip install --upgrade pip

# 再度インストール
pip install -r requirements.txt
```