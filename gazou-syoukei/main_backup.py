import cv2
import numpy as np
from PIL import Image, ImageDraw
import tkinter as tk
from tkinter import filedialog, Button, Label, Canvas, messagebox, Entry, StringVar, Frame
from PIL import ImageTk
import os
import base64
import json
from openai import OpenAI

class ImageToCharacterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("画像から象形文字ジェネレーター")
        self.root.geometry("900x750")
        
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
        api_frame = Frame(self.root, bg="lightblue", height=50)
        api_frame.pack(pady=5, fill=tk.X, padx=20)
        api_frame.pack_propagate(False)
        
        Label(api_frame, text="OpenAI APIキー:", bg="lightblue").pack(side=tk.LEFT, padx=5, pady=10)
        api_entry = Entry(api_frame, textvariable=self.api_key, width=40, show="*")
        api_entry.pack(side=tk.LEFT, padx=5, pady=10)
        
        Button(api_frame, text="保存", command=self.save_api_key).pack(side=tk.LEFT, padx=5, pady=10)
        
        # 上部フレーム（ボタン用）
        top_frame = Frame(self.root)
        top_frame.pack(pady=10)
        
        # 画像選択ボタン
        self.select_btn = Button(top_frame, text="画像を選択", command=self.select_image)
        self.select_btn.pack(side=tk.LEFT, padx=10)
        
        # 変換ボタン
        self.convert_btn = Button(top_frame, text="象形文字に変換", command=self.convert_to_character)
        self.convert_btn.pack(side=tk.LEFT, padx=10)
        self.convert_btn.config(state=tk.DISABLED)
        
        # 保存ボタン
        self.save_btn = Button(top_frame, text="画像を保存", command=self.save_image)
        self.save_btn.pack(side=tk.LEFT, padx=10)
        self.save_btn.config(state=tk.DISABLED)
        
        # 中央フレーム（画像表示用）
        self.center_frame = Frame(self.root)
        self.center_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        # 元画像表示用ラベル
        self.input_frame = Frame(self.center_frame)
        self.input_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.input_label = Label(self.input_frame, text="元の画像")
        self.input_label.pack()
        
        self.input_canvas = Canvas(self.input_frame, bg="lightgray")
        self.input_canvas.pack(fill=tk.BOTH, expand=True)
        
        # 変換後画像表示用ラベル
        self.output_frame = Frame(self.center_frame)
        self.output_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        self.output_label = Label(self.output_frame, text="象形文字")
        self.output_label.pack()
        
        self.output_canvas = Canvas(self.output_frame, bg="lightgray")
        self.output_canvas.pack(fill=tk.BOTH, expand=True)
        
        # 説明テキスト表示用フレーム
        self.description_frame = Frame(self.root)
        self.description_frame.pack(fill=tk.X, padx=20, pady=5)
        
        Label(self.description_frame, text="ChatGPTによる象形文字の説明:").pack(anchor=tk.W)
        
        self.description_text = tk.Text(self.description_frame, height=4, wrap=tk.WORD)
        self.description_text.pack(fill=tk.X, pady=5)
        self.description_text.config(state=tk.DISABLED)
        
        # ステータスバー
        self.status_label = Label(self.root, text="画像を選択してください", bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.pack(side=tk.BOTTOM, fill=tk.X)
    
    def select_image(self):
        file_path = filedialog.askopenfilename(
            title="画像を選択",
            filetypes=[("Image files", "*.jpg *.jpeg *.png *.bmp *.gif")]
        )
        
        if file_path:
            self.input_image_path = file_path
            self.display_input_image()
            self.convert_btn.config(state=tk.NORMAL)
            self.status_label.config(text=f"選択された画像: {os.path.basename(file_path)}")
    
    def display_input_image(self):
        # 入力画像を表示
        img = Image.open(self.input_image_path)
        img = self.resize_image_to_fit(img, self.input_canvas)
        
        self.input_photo = ImageTk.PhotoImage(img)
        self.input_canvas.config(width=img.width, height=img.height)
        self.input_canvas.create_image(0, 0, anchor=tk.NW, image=self.input_photo)
    
    def resize_image_to_fit(self, img, canvas, max_width=350, max_height=400):
        # キャンバスに合わせて画像をリサイズ
        width, height = img.size
        
        if width > max_width or height > max_height:
            ratio = min(max_width / width, max_height / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            return img.resize((new_width, new_height), Image.LANCZOS)
        
        return img
    
    def load_api_key(self):
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            api_key_path = os.path.join(script_dir, "api_key.json")
            
            if os.path.exists(api_key_path):
                with open(api_key_path, "r") as f:
                    data = json.load(f)
                    self.api_key.set(data.get("api_key", ""))
                    if self.api_key.get():
                        self.client = OpenAI(api_key=self.api_key.get())
        except Exception as e:
            print(f"APIキーの読み込みエラー: {str(e)}")
    
    def save_api_key(self):
        try:
            api_key = self.api_key.get()
            if api_key:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                api_key_path = os.path.join(script_dir, "api_key.json")
                
                with open(api_key_path, "w") as f:
                    json.dump({"api_key": api_key}, f)
                self.client = OpenAI(api_key=api_key)
                messagebox.showinfo("成功", "APIキーが保存されました")
            else:
                messagebox.showwarning("警告", "APIキーが入力されていません")
        except Exception as e:
            messagebox.showerror("エラー", f"APIキーの保存中にエラーが発生しました: {str(e)}")
    
    def convert_to_character(self):
        if not self.input_image_path:
            return
        
        if not self.api_key.get() or not self.client:
            messagebox.showwarning("警告", "OpenAI APIキーが設定されていません。APIキーを入力して保存してください。")
            return
        
        self.status_label.config(text="変換中...")
        self.root.update()
        
        # 画像から特徴を抽出し、象形文字を生成
        self.output_image, self.character_description = self.generate_character_from_image(self.input_image_path)
        
        # 結果を表示
        self.display_output_image()
        self.save_btn.config(state=tk.NORMAL)
        self.status_label.config(text="変換完了")
        
        # 説明テキストを表示
        self.description_text.config(state=tk.NORMAL)
        self.description_text.delete(1.0, tk.END)
        self.description_text.insert(tk.END, self.character_description)
        self.description_text.config(state=tk.DISABLED)
    
    def generate_character_from_image(self, image_path):
        # 画像を読み込み
        img = cv2.imread(image_path)
        if img is None:
            return None, "画像の読み込みに失敗しました。"
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # エッジ検出
        edges = cv2.Canny(gray, 50, 150)
        
        # 輪郭検出
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # 最も大きい輪郭を取得
        if contours:
            main_contour = max(contours, key=cv2.contourArea)
            
            # 輪郭を単純化
            epsilon = 0.01 * cv2.arcLength(main_contour, True)
            approx_contour = cv2.approxPolyDP(main_contour, epsilon, True)
            
            # 象形文字のような画像を生成
            # 白い背景に黒い線で描画
            canvas_size = (500, 500)
            character_img = Image.new('RGB', canvas_size, color='white')
            draw = ImageDraw.Draw(character_img)
            
            # 輪郭の座標を正規化して描画
            h, w = edges.shape
            scale_x = canvas_size[0] / w
            scale_y = canvas_size[1] / h
            
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
            
            # ChatGPT APIを使用して象形文字の説明を生成
            description = self.generate_character_description(contour_features, file_name_without_ext)
            
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
            
            # 線を太くして象形文字らしく
            for i in range(len(points)):
                start = points[i]
                end = points[(i + 1) % len(points)]
                draw.line([start, end], fill='black', width=5)
            
            return character_img, description
        else:
            # 輪郭が見つからない場合は元の画像をグレースケールで返す
            pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            file_name = os.path.basename(image_path)
            file_name_without_ext = os.path.splitext(file_name)[0]
            description = self.generate_simple_description(file_name_without_ext)
            return pil_img, description
    
    def display_output_image(self):
        if self.output_image:
            # 出力画像をリサイズして表示
            img = self.resize_image_to_fit(self.output_image, self.output_canvas)
            
            self.output_photo = ImageTk.PhotoImage(img)
            self.output_canvas.config(width=img.width, height=img.height)
            self.output_canvas.create_image(0, 0, anchor=tk.NW, image=self.output_photo)
    
    def save_image(self):
        if not self.output_image:
            return
        
        file_path = filedialog.asksaveasfilename(
            title="象形文字を保存",
            defaultextension=".png",
            filetypes=[("PNG files", "*.png"), ("All files", "*.*")]
        )
        
        if file_path:
            self.output_image.save(file_path)
            self.status_label.config(text=f"画像を保存しました: {os.path.basename(file_path)}")

    def generate_character_description(self, contour_features, image_name):
        """ChatGPT APIを使用して象形文字の説明を生成"""
        try:
            if not self.client:
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
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "あなたは古代文字の専門家です。象形文字の特徴から、その意味や用途を説明してください。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            return f"この象形文字は{image_name}を表しています。古代の人々はこの形を使って重要な概念を表現していました。"
    
    def generate_simple_description(self, image_name):
        """輪郭が見つからない場合の簡単な説明を生成"""
        try:
            if not self.client:
                return "OpenAI APIクライアントが初期化されていません。APIキーを設定してください。"
                
            # 輪郭が見つからない場合の簡単な説明
            prompt = f"""
            「{image_name}」という名前の画像から生成された象形文字について、古代文字のような説明を100文字程度で作成してください。
            説明は「この象形文字は...」で始めてください。
            """
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "あなたは古代文字の専門家です。象形文字の特徴から、その意味や用途を説明してください。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
                
        except Exception as e:
            return f"この象形文字は{image_name}を表しています。古代の人々はこの形を使って重要な概念を表現していました。"

def main():
    root = tk.Tk()
    app = ImageToCharacterApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()