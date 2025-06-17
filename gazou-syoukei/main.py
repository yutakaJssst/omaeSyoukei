import cv2
import numpy as np
from PIL import Image, ImageDraw
import tkinter as tk
from tkinter import filedialog, Button, Label, Canvas
from PIL import ImageTk
import os

class ImageToCharacterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("画像から象形文字ジェネレーター")
        self.root.geometry("800x600")
        
        self.input_image_path = None
        self.output_image = None
        
        # UIの設定
        self.setup_ui()
    
    def setup_ui(self):
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
    app = ImageToCharacterApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()