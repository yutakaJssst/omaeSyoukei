import cv2
import numpy as np
from PIL import Image, ImageDraw
import tkinter as tk
from tkinter import filedialog, Button, Label, Canvas, messagebox, Entry, StringVar
from PIL import ImageTk
import os
import traceback
import json
import threading
from openai import OpenAI

class ImageToCharacterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("画像から象形文字ジェネレーター (ChatGPT版)")
        self.root.geometry("800x700")
        
        self.input_image_path = None
        self.output_image = None
        self.api_key = StringVar()
        self.character_description = ""
        
        # OpenAIクライアント
        self.client = None
        
        # APIキーの読み込み
        self.load_api_key()
        
        # UIの設定
        self.setup_ui()
    
    def setup_ui(self):
        # APIキー設定フレーム
        api_frame = tk.Frame(self.root)
        api_frame.pack(pady=5, fill=tk.X, padx=20)
        
        Label(api_frame, text="OpenAI APIキー:").pack(side=tk.LEFT, padx=5)
        api_entry = Entry(api_frame, textvariable=self.api_key, width=40, show="*")
        api_entry.pack(side=tk.LEFT, padx=5)
        
        Button(api_frame, text="保存", command=self.save_api_key).pack(side=tk.LEFT, padx=5)
        
        # 上部フレーム（ボタン用）
        top_frame = tk.Frame(self.root)
        top_frame.pack(pady=10)
        
        # 画像選択ボタン
        self.select_btn = Button(top_frame, text="画像を選択", command=self.select_image)
        self.select_btn.pack(side=tk.LEFT, padx=10)
        
        # 変換ボタン
        self.convert_btn = Button(top_frame, text="象形文字に変換", command=self.convert_to_character)
        self.convert_btn.pack(side=tk.LEFT, padx=10)
        self.convert_btn.config(state=tk.DISABLED)
        
        # 画像に変換ボタン
        self.image_convert_btn = Button(top_frame, text="画像に変換", command=self.convert_to_image)
        self.image_convert_btn.pack(side=tk.LEFT, padx=10)
        self.image_convert_btn.config(state=tk.DISABLED)
        
        # 保存ボタン
        self.save_btn = Button(top_frame, text="画像を保存", command=self.save_image)
        self.save_btn.pack(side=tk.LEFT, padx=10)
        self.save_btn.config(state=tk.DISABLED)
        
        # 中央フレーム（画像表示用）
        self.center_frame = tk.Frame(self.root)
        self.center_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        # 元画像表示用ラベル
        self.input_frame = tk.Frame(self.center_frame)
        self.input_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.input_label = Label(self.input_frame, text="元の画像")
        self.input_label.pack()
        
        self.input_canvas = Canvas(self.input_frame, bg="lightgray")
        self.input_canvas.pack(fill=tk.BOTH, expand=True)
        
        # 変換後画像表示用ラベル
        self.output_frame = tk.Frame(self.center_frame)
        self.output_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        self.output_label = Label(self.output_frame, text="象形文字")
        self.output_label.pack()
        
        self.output_canvas = Canvas(self.output_frame, bg="lightgray")
        self.output_canvas.pack(fill=tk.BOTH, expand=True)
        
        # 処理過程表示用フレーム
        self.process_frame = tk.Frame(self.root)
        self.process_frame.pack(fill=tk.X, padx=20, pady=5)
        
        Label(self.process_frame, text="処理過程:").pack(anchor=tk.W)
        
        self.process_text = tk.Text(self.process_frame, height=4, wrap=tk.WORD)
        self.process_text.pack(fill=tk.X, pady=5)
        
        # 説明テキスト表示用フレーム
        self.description_frame = tk.Frame(self.root)
        self.description_frame.pack(fill=tk.X, padx=20, pady=5)
        
        Label(self.description_frame, text="ChatGPTによる象形文字の説明:").pack(anchor=tk.W)
        
        self.description_text = tk.Text(self.description_frame, height=4, wrap=tk.WORD)
        self.description_text.pack(fill=tk.X, pady=5)
        self.description_text.config(state=tk.DISABLED)
        
        # ステータスバー
        self.status_label = Label(self.root, text="画像を選択してください", bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.pack(side=tk.BOTTOM, fill=tk.X)
    
    def load_api_key(self):
        try:
            # スクリプトのディレクトリを取得
            script_dir = os.path.dirname(os.path.abspath(__file__))
            api_key_path = os.path.join(script_dir, "api_key.json")
            
            if os.path.exists(api_key_path):
                with open(api_key_path, "r") as f:
                    data = json.load(f)
                    self.api_key.set(data.get("api_key", ""))
                    if self.api_key.get():
                        self.client = OpenAI(api_key=self.api_key.get())
                        print("OpenAIクライアントを初期化しました")
        except Exception as e:
            print(f"APIキーの読み込みエラー: {str(e)}")
    
    def save_api_key(self):
        try:
            api_key = self.api_key.get()
            if api_key:
                # スクリプトのディレクトリを取得
                script_dir = os.path.dirname(os.path.abspath(__file__))
                api_key_path = os.path.join(script_dir, "api_key.json")
                
                with open(api_key_path, "w") as f:
                    json.dump({"api_key": api_key}, f)
                self.client = OpenAI(api_key=api_key)
                messagebox.showinfo("成功", "APIキーが保存されました")
                print("OpenAIクライアントを初期化しました")
            else:
                messagebox.showwarning("警告", "APIキーが入力されていません")
        except Exception as e:
            messagebox.showerror("エラー", f"APIキーの保存中にエラーが発生しました: {str(e)}")
    
    def select_image(self):
        file_path = filedialog.askopenfilename(
            title="画像を選択",
            filetypes=[("Image files", "*.jpg *.jpeg *.png *.bmp *.gif")]
        )
        
        if file_path:
            try:
                # 画像が読み込めるか確認
                test_img = cv2.imread(file_path)
                if test_img is None:
                    messagebox.showerror("エラー", "画像を読み込めませんでした。別の画像を選択してください。")
                    return
                
                self.input_image_path = file_path
                self.display_input_image()
                self.convert_btn.config(state=tk.NORMAL)
                self.status_label.config(text=f"選択された画像: {os.path.basename(file_path)}")
            except Exception as e:
                messagebox.showerror("エラー", f"画像の読み込み中にエラーが発生しました: {str(e)}")
                print(f"エラー詳細: {traceback.format_exc()}")
    
    def display_input_image(self):
        try:
            # 入力画像を表示
            img = Image.open(self.input_image_path)
            img = self.resize_image_to_fit(img, self.input_canvas)
            
            self.input_photo = ImageTk.PhotoImage(img)
            self.input_canvas.config(width=img.width, height=img.height)
            self.input_canvas.create_image(0, 0, anchor=tk.NW, image=self.input_photo)
        except Exception as e:
            messagebox.showerror("エラー", f"画像の表示中にエラーが発生しました: {str(e)}")
            print(f"エラー詳細: {traceback.format_exc()}")
    
    def resize_image_to_fit(self, img, canvas, max_width=350, max_height=400):
        # キャンバスに合わせて画像をリサイズ
        width, height = img.size
        
        if width > max_width or height > max_height:
            ratio = min(max_width / width, max_height / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            return img.resize((new_width, new_height), Image.LANCZOS)
        
        return img
    
    def convert_to_character(self):
        if not self.input_image_path:
            return
        
        if not self.api_key.get() or not self.client:
            messagebox.showwarning("警告", "OpenAI APIキーが設定されていません。APIキーを入力して保存してください。")
            return
        
        try:
            self.status_label.config(text="変換中...")
            self.root.update()
            
            # 処理テキストをクリア
            self.process_text.delete(1.0, tk.END)
            self.update_process_text("画像処理を開始します...")
            
            # 非同期で処理を実行
            threading.Thread(target=self._process_image, daemon=True).start()
            
            # 画像に変換ボタンを有効化
            self.image_convert_btn.config(state=tk.NORMAL)
            
        except Exception as e:
            self.status_label.config(text="エラーが発生しました")
            messagebox.showerror("エラー", f"変換中にエラーが発生しました: {str(e)}")
            print(f"エラー詳細: {traceback.format_exc()}")
    
    def convert_to_image(self):
        """画像に変換ボタンが押されたときの処理"""
        if not self.input_image_path:
            return
        
        try:
            self.save_image()
        except Exception as e:
            self.status_label.config(text="エラーが発生しました")
            messagebox.showerror("エラー", f"画像の保存中にエラーが発生しました: {str(e)}")
            print(f"エラー詳細: {traceback.format_exc()}")
    
    def update_process_text(self, text):
        """処理過程テキストを更新する"""
        def _update():
            self.process_text.insert(tk.END, text + "\n")
            self.process_text.see(tk.END)  # 最新の行にスクロール
            self.root.update()
        
        # UIスレッドで実行
        self.root.after(0, _update)
    
    def _process_image(self):
        try:
            print("画像処理を開始します")
            # 画像から特徴を抽出し、象形文字を生成
            self.output_image, self.character_description = self.generate_character_from_image(self.input_image_path)
            
            self.update_process_text(f"生成された画像: {self.output_image is not None}")
            print(f"生成された output_image: {self.output_image is not None}")
            print(f"output_image の種類: {type(self.output_image) if self.output_image else 'None'}")
            
            # output_imageがNoneの場合は、空白の画像を生成
            if self.output_image is None:
                self.update_process_text("画像生成に失敗したため、空白の画像を生成します")
                print("output_imageがNoneのため、空白の画像を生成します")
                self.output_image = Image.new('RGB', (500, 500), color='white')
                self.character_description = "画像の生成に失敗しました。別の画像を試してください。"
            
            # UIスレッドで結果を表示
            self.root.after(0, self._update_ui_after_processing)
        except Exception as e:
            error_msg = f"画像処理中にエラーが発生しました: {str(e)}"
            self.update_process_text(error_msg)
            print(error_msg)
            print(traceback.format_exc())
            # エラーが発生しても空白の画像を生成
            self.output_image = Image.new('RGB', (500, 500), color='white')
            self.character_description = f"エラーが発生しました: {str(e)}"
            self.root.after(0, self._update_ui_after_processing)
    
    def _update_ui_after_processing(self):
        print("_update_ui_after_processing メソッドが呼び出されました")
        # 結果を表示
        if self.output_image:
            print(f"output_image が存在します: {type(self.output_image)}")
            try:
                self.display_output_image()
                self.save_btn.config(state=tk.NORMAL)
                self.status_label.config(text="変換完了")
                
                # 説明テキストを表示
                self.description_text.config(state=tk.NORMAL)
                self.description_text.delete(1.0, tk.END)
                self.description_text.insert(tk.END, self.character_description)
                self.description_text.config(state=tk.DISABLED)
                print("UI の更新が完了しました")
            except Exception as e:
                print(f"UI更新中にエラーが発生しました: {str(e)}")
                print(traceback.format_exc())
                # エラーが発生しても保存ボタンを有効にする
                self.save_btn.config(state=tk.NORMAL)
                self.status_label.config(text="変換完了（一部エラーあり）")
        else:
            print("output_image が None です")
            # output_imageがNoneの場合でも保存ボタンを有効にする
            self.save_btn.config(state=tk.NORMAL)
            self.status_label.config(text="変換に失敗しましたが、保存は可能です")
            messagebox.showwarning("警告", "象形文字の生成に一部問題がありましたが、保存は可能です。")
    
    def _show_error(self, error_message):
        self.status_label.config(text="エラーが発生しました")
        messagebox.showerror("エラー", f"変換中にエラーが発生しました: {error_message}")
    
    def generate_character_from_image(self, image_path):
        try:
            # 画像を読み込み
            self.update_process_text(f"画像を読み込み中: {image_path}")
            print(f"画像を読み込み中: {image_path}")
            img = cv2.imread(image_path)
            if img is None:
                self.update_process_text("画像の読み込みに失敗しました")
                print("画像の読み込みに失敗しました")
                return None, ""
            
            self.update_process_text(f"画像サイズ: {img.shape}")
            print(f"画像サイズ: {img.shape}")
            
            # グレースケール変換
            self.update_process_text("グレースケールに変換中...")
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # エッジ検出
            self.update_process_text("エッジ検出を実行中...")
            edges = cv2.Canny(gray, 30, 100)  # しきい値を調整
            self.update_process_text("エッジ検出完了")
            
            # 輪郭検出
            self.update_process_text("輪郭検出を実行中...")
            contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            self.update_process_text(f"検出された輪郭の数: {len(contours)}")
            
            # 輪郭がない場合は別の方法を試す
            if not contours:
                self.update_process_text("輪郭が検出されませんでした。別の方法を試します...")
                # 閾値処理を試す
                _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
                contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
                self.update_process_text(f"閾値処理後の輪郭の数: {len(contours)}")
            
            # 最も大きい輪郭を取得
            if contours:
                # 面積でフィルタリング（小さすぎる輪郭を除外）
                filtered_contours = [cnt for cnt in contours if cv2.contourArea(cnt) > 100]
                
                if filtered_contours:
                    main_contour = max(filtered_contours, key=cv2.contourArea)
                    self.update_process_text(f"メイン輪郭の面積: {cv2.contourArea(main_contour):.2f}")
                    
                    # 輪郭を単純化
                    epsilon = 0.01 * cv2.arcLength(main_contour, True)
                    approx_contour = cv2.approxPolyDP(main_contour, epsilon, True)
                    self.update_process_text(f"単純化後の輪郭のポイント数: {len(approx_contour)}")
                    
                    # 輪郭の特徴を抽出
                    contour_features = {
                        "points_count": len(approx_contour),
                        "is_closed": True,
                        "area": cv2.contourArea(main_contour),
                        "perimeter": cv2.arcLength(main_contour, True),
                        "is_convex": cv2.isContourConvex(approx_contour)
                    }
                    
                    # 画像ファイル名から対象物を推測
                    file_name = os.path.basename(image_path)
                    file_name_without_ext = os.path.splitext(file_name)[0]
                    self.update_process_text(f"画像ファイル名: {file_name_without_ext}")
                    
                    # ChatGPT APIを使用して象形文字の説明を生成
                    self.update_process_text("ChatGPT APIを使用して説明を生成中...")
                    print("ChatGPT APIを使用して説明を生成します...")
                    description = self.generate_character_description(contour_features, file_name_without_ext)
                    self.update_process_text(f"説明の生成完了: {description[:30]}...")
                    print(f"説明の生成完了: {description[:30]}...")
                    
                    # 象形文字のような画像を生成
                    self.update_process_text("象形文字画像の生成を開始します")
                    # 白い背景に黒い線で描画
                    canvas_size = (500, 500)
                    character_img = Image.new('RGB', canvas_size, color='white')
                    draw = ImageDraw.Draw(character_img)
                    self.update_process_text("キャンバスの作成完了")
                    
                    # 輪郭の座標を正規化して描画
                    h, w = gray.shape
                    scale_x = canvas_size[0] / w
                    scale_y = canvas_size[1] / h
                    
                    # 中心に配置するためのオフセットを計算
                    x_min = min(point[0][0] for point in approx_contour)
                    y_min = min(point[0][1] for point in approx_contour)
                    x_max = max(point[0][0] for point in approx_contour)
                    y_max = max(point[0][1] for point in approx_contour)
                    
                    contour_width = x_max - x_min
                    contour_height = y_max - y_min
                    
                    offset_x = (w - contour_width) // 2 - x_min
                    offset_y = (h - contour_height) // 2 - y_min
                    
                    # 輪郭を描画
                    points = []
                    for point in approx_contour:
                        x = int((point[0][0] + offset_x) * scale_x)
                        y = int((point[0][1] + offset_y) * scale_y)
                        points.append((x, y))
                    
                    self.update_process_text(f"描画するポイント数: {len(points)}")
                    
                    # 線を太くして象形文字らしく
                    for i in range(len(points)):
                        start = points[i]
                        end = points[(i + 1) % len(points)]
                        draw.line([start, end], fill='black', width=5)
                    
                    self.update_process_text("象形文字の生成が完了しました")
                    print(f"character_img の種類: {type(character_img)}")
                    print(f"character_img のサイズ: {character_img.size}")
                    return character_img, description
                else:
                    self.update_process_text("有効な輪郭が見つかりませんでした")
            
            # 輪郭が見つからない場合は元の画像をグレースケールで返す
            self.update_process_text("輪郭が見つからないため、元の画像を処理します")
            # 画像を二値化して象形文字風に
            _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
            pil_img = Image.fromarray(binary)
            
            # 簡単な説明を生成
            file_name = os.path.basename(image_path)
            file_name_without_ext = os.path.splitext(file_name)[0]
            description = self.generate_simple_description(file_name_without_ext)
            
            return pil_img, description
            
        except Exception as e:
            error_msg = f"画像処理中にエラーが発生しました: {str(e)}"
            self.update_process_text(error_msg)
            print(error_msg)
            print(traceback.format_exc())
            return None, ""
    
    def generate_character_description(self, contour_features, image_name):
        try:
            self.update_process_text("説明生成メソッドを呼び出し中...")
            print("generate_character_description メソッドが呼び出されました")
            if not self.client:
                self.update_process_text("OpenAI クライアントが初期化されていません")
                print("OpenAI クライアントが初期化されていません")
                return "OpenAI APIクライアントが初期化されていません。APIキーを設定してください。"
                
            # OpenAI APIを使用して象形文字の説明を生成
            prompt = f"""
            以下の特徴を持つ輪郭から生成された象形文字について、古代文字のような説明を100文字程度で作成してください。
            説明は「この象形文字は...」で始めてください。

            - 画像名: {image_name}
            - 点の数: {contour_features['points_count']}
            - 閉じた形状: {'はい' if contour_features['is_closed'] else 'いいえ'}
            - 面積: {contour_features['area']:.2f}
            - 周囲長: {contour_features['perimeter']:.2f}
            - 凸形状: {'はい' if contour_features['is_convex'] else 'いいえ'}
            """
            
            self.update_process_text("OpenAI API リクエストを送信中...")
            print("OpenAI API リクエストを送信します...")
            try:
                self.update_process_text("ChatGPT APIに接続中...")
                response = self.client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "あなたは古代文字の専門家です。象形文字の特徴から、その意味や用途を説明してください。"},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=200,
                    temperature=0.7
                )
                
                description = response.choices[0].message.content.strip()
                self.update_process_text(f"ChatGPTからの応答を受信しました")
                self.update_process_text(f"生成された説明: {description[:50]}...")
                print(f"生成された説明: {description}")
                return description
            except Exception as api_error:
                error_msg = f"OpenAI API 呼び出し中にエラーが発生しました: {str(api_error)}"
                self.update_process_text(error_msg)
                print(error_msg)
                print(traceback.format_exc())
                # APIエラーが発生しても説明を返す
                fallback_msg = f"この象形文字は{image_name}を表しています。古代の人々はこの形を使って重要な概念を表現していました。"
                self.update_process_text(f"デフォルトの説明を使用します: {fallback_msg[:30]}...")
                return fallback_msg
            
        except Exception as e:
            error_msg = f"説明の生成中にエラーが発生しました: {str(e)}"
            self.update_process_text(error_msg)
            print(error_msg)
            print(traceback.format_exc())
            # エラーが発生しても説明を返す
            return f"この象形文字は{image_name}を表しています。古代の人々はこの形を使って重要な概念を表現していました。"
    
    def generate_simple_description(self, image_name):
        try:
            self.update_process_text("簡易説明生成メソッドを呼び出し中...")
            if not self.client:
                self.update_process_text("OpenAI クライアントが初期化されていません")
                return "OpenAI APIクライアントが初期化されていません。APIキーを設定してください。"
                
            # 輪郭が見つからない場合の簡単な説明
            prompt = f"""
            「{image_name}」という名前の画像から生成された象形文字について、古代文字のような説明を100文字程度で作成してください。
            説明は「この象形文字は...」で始めてください。
            """
            
            self.update_process_text("OpenAI API リクエストを送信中（簡易説明）...")
            try:
                response = self.client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "あなたは古代文字の専門家です。象形文字の特徴から、その意味や用途を説明してください。"},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=200,
                    temperature=0.7
                )
                
                description = response.choices[0].message.content.strip()
                self.update_process_text(f"簡易説明の生成完了: {description[:30]}...")
                print(f"生成された説明: {description}")
                return description
            except Exception as api_error:
                error_msg = f"OpenAI API 呼び出し中にエラーが発生しました: {str(api_error)}"
                self.update_process_text(error_msg)
                print(error_msg)
                # APIエラーが発生しても説明を返す
                return f"この象形文字は{image_name}を表しています。古代の人々はこの形を使って重要な概念を表現していました。"
                
        except Exception as e:
            error_msg = f"説明の生成中にエラーが発生しました: {str(e)}"
            self.update_process_text(error_msg)
            print(error_msg)
            return f"象形文字の説明を生成できませんでした。エラー: {str(e)}"
    
    def display_output_image(self):
        try:
            if self.output_image:
                # 出力画像をリサイズして表示
                img = self.resize_image_to_fit(self.output_image, self.output_canvas)
                
                self.output_photo = ImageTk.PhotoImage(img)
                self.output_canvas.config(width=img.width, height=img.height)
                self.output_canvas.create_image(0, 0, anchor=tk.NW, image=self.output_photo)
        except Exception as e:
            messagebox.showerror("エラー", f"画像の表示中にエラーが発生しました: {str(e)}")
            print(f"エラー詳細: {traceback.format_exc()}")
    
    def save_image(self):
        print("save_image メソッドが呼び出されました")
        if not self.output_image:
            print("output_image が None です")
            messagebox.showwarning("警告", "保存する画像がありません。象形文字に変換してから保存してください。")
            return
        
        try:
            print(f"output_image の種類: {type(self.output_image)}")
            file_path = filedialog.asksaveasfilename(
                title="象形文字を保存",
                defaultextension=".png",
                filetypes=[("PNG files", "*.png"), ("All files", "*.*")]
            )
            
            print(f"選択されたファイルパス: {file_path}")
            
            if file_path:
                print(f"画像を保存します: {file_path}")
                self.output_image.save(file_path)
                self.status_label.config(text=f"画像を保存しました: {os.path.basename(file_path)}")
                print("画像の保存が完了しました")
            else:
                print("ファイルパスが選択されませんでした")
        except Exception as e:
            error_msg = f"画像の保存中にエラーが発生しました: {str(e)}"
            messagebox.showerror("エラー", error_msg)
            print(f"エラー詳細: {traceback.format_exc()}")

def main():
    root = tk.Tk()
    app = ImageToCharacterApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()