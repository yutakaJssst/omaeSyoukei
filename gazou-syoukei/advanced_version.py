import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import tkinter as tk
from tkinter import filedialog, Button, Label, Canvas, Scale, IntVar, Frame, HORIZONTAL, Radiobutton
from PIL import ImageTk
import os

class AdvancedImageToCharacterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("高度な画像から象形文字ジェネレーター")
        self.root.geometry("1000x700")
        
        self.input_image_path = None
        self.output_image = None
        self.processed_edges = None
        self.contours = None
        
        # パラメータの初期値
        self.canny_threshold1 = IntVar(value=50)
        self.canny_threshold2 = IntVar(value=150)
        self.contour_simplification = IntVar(value=10)  # 0.01 * 1000 = 10
        self.line_thickness = IntVar(value=5)
        self.style_option = IntVar(value=0)  # 0: 輪郭のみ, 1: 塗りつぶし, 2: テクスチャ付き
        
        # UIの設定
        self.setup_ui()
    
    def setup_ui(self):
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
        
        # パラメータ調整用フレーム
        param_frame = Frame(self.root)
        param_frame.pack(fill=tk.X, padx=20, pady=10)
        
        # Cannyエッジ検出のしきい値1
        Label(param_frame, text="エッジ検出 しきい値1:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=2)
        Scale(param_frame, from_=0, to=255, orient=HORIZONTAL, variable=self.canny_threshold1, 
              length=200).grid(row=0, column=1, padx=5, pady=2)
        
        # Cannyエッジ検出のしきい値2
        Label(param_frame, text="エッジ検出 しきい値2:").grid(row=1, column=0, sticky=tk.W, padx=5, pady=2)
        Scale(param_frame, from_=0, to=255, orient=HORIZONTAL, variable=self.canny_threshold2, 
              length=200).grid(row=1, column=1, padx=5, pady=2)
        
        # 輪郭の単純化レベル
        Label(param_frame, text="輪郭の単純化レベル:").grid(row=0, column=2, sticky=tk.W, padx=5, pady=2)
        Scale(param_frame, from_=1, to=100, orient=HORIZONTAL, variable=self.contour_simplification, 
              length=200).grid(row=0, column=3, padx=5, pady=2)
        
        # 線の太さ
        Label(param_frame, text="線の太さ:").grid(row=1, column=2, sticky=tk.W, padx=5, pady=2)
        Scale(param_frame, from_=1, to=20, orient=HORIZONTAL, variable=self.line_thickness, 
              length=200).grid(row=1, column=3, padx=5, pady=2)
        
        # スタイルオプション
        style_frame = Frame(param_frame)
        style_frame.grid(row=2, column=0, columnspan=4, sticky=tk.W, padx=5, pady=5)
        
        Label(style_frame, text="スタイル:").pack(side=tk.LEFT, padx=5)
        Radiobutton(style_frame, text="輪郭のみ", variable=self.style_option, value=0).pack(side=tk.LEFT, padx=10)
        Radiobutton(style_frame, text="塗りつぶし", variable=self.style_option, value=1).pack(side=tk.LEFT, padx=10)
        Radiobutton(style_frame, text="テクスチャ付き", variable=self.style_option, value=2).pack(side=tk.LEFT, padx=10)
        
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
    
    def resize_image_to_fit(self, img, canvas, max_width=400, max_height=400):
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
        
        self.status_label.config(text="変換中...")
        self.root.update()
        
        # 画像から特徴を抽出し、象形文字を生成
        self.output_image = self.generate_character_from_image(self.input_image_path)
        
        # 結果を表示
        self.display_output_image()
        self.save_btn.config(state=tk.NORMAL)
        self.status_label.config(text="変換完了")
    
    def generate_character_from_image(self, image_path):
        # 画像を読み込み
        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # エッジ検出（パラメータ調整可能）
        edges = cv2.Canny(gray, self.canny_threshold1.get(), self.canny_threshold2.get())
        self.processed_edges = edges.copy()
        
        # 輪郭検出
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        self.contours = contours
        
        # 最も大きい輪郭を取得
        if contours:
            main_contour = max(contours, key=cv2.contourArea)
            
            # 輪郭を単純化（パラメータ調整可能）
            epsilon = (self.contour_simplification.get() / 1000) * cv2.arcLength(main_contour, True)
            approx_contour = cv2.approxPolyDP(main_contour, epsilon, True)
            
            # 象形文字のような画像を生成
            canvas_size = (500, 500)
            character_img = Image.new('RGB', canvas_size, color='white')
            draw = ImageDraw.Draw(character_img)
            
            # 輪郭の座標を正規化して描画
            h, w = edges.shape
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
            
            # スタイルに応じて描画
            style = self.style_option.get()
            
            if style == 0:  # 輪郭のみ
                for i in range(len(points)):
                    start = points[i]
                    end = points[(i + 1) % len(points)]
                    draw.line([start, end], fill='black', width=self.line_thickness.get())
            
            elif style == 1:  # 塗りつぶし
                draw.polygon(points, outline='black', fill='black')
            
            elif style == 2:  # テクスチャ付き
                # まず輪郭を描画
                for i in range(len(points)):
                    start = points[i]
                    end = points[(i + 1) % len(points)]
                    draw.line([start, end], fill='black', width=self.line_thickness.get())
                
                # テクスチャ効果（ノイズや筆のストロークを模倣）
                texture_img = character_img.copy()
                draw_texture = ImageDraw.Draw(texture_img)
                
                # ポリゴン内部に短い線をランダムに描画してテクスチャを作成
                import random
                for _ in range(50):
                    x1 = random.randint(min(p[0] for p in points), max(p[0] for p in points))
                    y1 = random.randint(min(p[1] for p in points), max(p[1] for p in points))
                    x2 = x1 + random.randint(-30, 30)
                    y2 = y1 + random.randint(-30, 30)
                    draw_texture.line([(x1, y1), (x2, y2)], fill='black', width=1)
                
                # 元の画像とテクスチャをブレンド
                character_img = Image.blend(character_img, texture_img, 0.3)
                
                # 少しぼかして古い象形文字のような効果を追加
                character_img = character_img.filter(ImageFilter.GaussianBlur(0.5))
            
            return character_img
        else:
            # 輪郭が見つからない場合は元の画像をグレースケールで返す
            pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            return pil_img
    
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

def main():
    root = tk.Tk()
    app = AdvancedImageToCharacterApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()