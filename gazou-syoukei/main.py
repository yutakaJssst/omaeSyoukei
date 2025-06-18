import tkinter as tk
from tkinter import *
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageTk
import os
import threading
from openai import OpenAI

# APIキーをここに設定してください
OPENAI_API_KEY = "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"

class ImageToCharacterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("画像から象形文字ジェネレーター")
        self.root.geometry("900x800")
        
        # アプリケーションの状態管理
        self.is_destroyed = False
        
        # macOSでの描画問題を軽減するための設定
        self.root.update_idletasks()
        
        # ウィンドウを前面に表示
        self.root.lift()
        self.root.attributes('-topmost', True)
        self.root.after(100, lambda: self.root.attributes('-topmost', False))
        
        # アプリケーション終了時のクリーンアップを設定
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        self.input_image_path = None
        self.output_image = None
        self.character_description = ""
        
        # OpenAIクライアントの初期化
        try:
            if OPENAI_API_KEY == "your-api-key-here":
                print("APIキーが設定されていません。デフォルト値のままです。")
                self.client = None
            else:
                self.client = OpenAI(api_key=OPENAI_API_KEY)
                print("OpenAI クライアントを初期化しました")
        except Exception as e:
            print(f"OpenAI クライアントの初期化に失敗しました: {e}")
            self.client = None
        
        # UIの設定
        self.setup_ui()
    
    def on_closing(self):
        """アプリケーション終了時の処理"""
        self.is_destroyed = True
        self.root.destroy()
    
    
    def setup_ui(self):
        # メインコンテナ
        main_container = Frame(self.root)
        main_container.pack(fill=BOTH, expand=True)
        
        # 操作ボタン部分
        button_container = Frame(main_container)
        button_container.pack(fill=X, padx=10, pady=10)
        
        # 画像選択ボタン
        self.select_btn = Button(button_container, text="画像を選択", command=self.select_image, font=("Arial", 12))
        self.select_btn.pack(side=LEFT, padx=10)
        
        # 変換ボタン
        self.convert_btn = Button(button_container, text="象形文字に変換", command=self.convert_to_character, font=("Arial", 12))
        self.convert_btn.pack(side=LEFT, padx=10)
        self.convert_btn.config(state=DISABLED)
        
        # 保存ボタン
        self.save_btn = Button(button_container, text="画像を保存", command=self.save_image, font=("Arial", 12))
        self.save_btn.pack(side=LEFT, padx=10)
        self.save_btn.config(state=DISABLED)
        
        # 画像表示部分
        image_container = Frame(main_container)
        image_container.pack(fill=BOTH, expand=True, padx=10, pady=5)
        
        # 元画像
        input_frame = Frame(image_container)
        input_frame.pack(side=LEFT, fill=BOTH, expand=True, padx=5)
        
        Label(input_frame, text="元の画像", font=("Arial", 14, "bold")).pack()
        self.input_canvas = Canvas(input_frame, bg="lightgray", width=400, height=400)
        self.input_canvas.pack(fill=BOTH, expand=True)
        
        # 変換後画像
        output_frame = Frame(image_container)
        output_frame.pack(side=RIGHT, fill=BOTH, expand=True, padx=5)
        
        Label(output_frame, text="象形文字", font=("Arial", 14, "bold")).pack()
        self.output_canvas = Canvas(output_frame, bg="lightgray", width=400, height=400)
        self.output_canvas.pack(fill=BOTH, expand=True)
        
        # 説明文表示部分
        desc_container = Frame(main_container)
        desc_container.pack(fill=X, padx=10, pady=5)
        
        Label(desc_container, text="ChatGPTによる象形文字の説明:", font=("Arial", 12, "bold")).pack(anchor=W)
        
        self.description_text = Text(desc_container, height=4, wrap=WORD, font=("Arial", 11))
        self.description_text.pack(fill=X, pady=5)
        self.description_text.config(state=DISABLED)
        
        # ステータスバー
        self.status_label = Label(self.root, text="画像を選択してください", bd=1, relief=SUNKEN, anchor=W)
        self.status_label.pack(side=BOTTOM, fill=X)
    
    def select_image(self):
        from tkinter import filedialog
        file_path = filedialog.askopenfilename(
            title="画像を選択",
            filetypes=[("Image files", "*.jpg *.jpeg *.png *.bmp *.gif")]
        )
        
        if file_path:
            self.input_image_path = file_path
            self.display_input_image()
            self.convert_btn.config(state=NORMAL)
            self.status_label.config(text=f"選択された画像: {os.path.basename(file_path)}")
    
    def display_input_image(self):
        if self.is_destroyed:
            return
            
        try:
            img = Image.open(self.input_image_path)
            img = self.resize_image_to_fit(img)
            
            if not self.is_destroyed:
                self.input_photo = ImageTk.PhotoImage(img)
                self.input_canvas.delete("all")
                self.input_canvas.create_image(200, 200, anchor=CENTER, image=self.input_photo)
                
                # macOSでの画像表示を確実にするための更新
                self.input_canvas.update_idletasks()
                self.root.update_idletasks()
                self.input_canvas.update()
                self.root.update()
            
        except Exception as e:
            print(f"入力画像表示エラー: {e}")
            import traceback
            traceback.print_exc()
            from tkinter import messagebox
            messagebox.showerror("エラー", f"画像の表示中にエラーが発生しました: {str(e)}")
    
    def resize_image_to_fit(self, img, canvas=None, max_width=350, max_height=350):
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
        
        if not self.client:
            from tkinter import messagebox
            messagebox.showwarning("警告", "OpenAI APIキーが設定されていません。コード内のOPENAI_API_KEYを設定してください。")
            return
        
        # ボタンを無効化して重複実行を防ぐ
        self.convert_btn.config(state=DISABLED)
        self.status_label.config(text="変換中...")
        self.root.update()
        
        # 非同期で処理を実行
        threading.Thread(target=self._process_image_async, daemon=True).start()
    
    def _process_image_async(self):
        try:
            # 画像から特徴を抽出し、象形文字を生成
            output_image, character_description = self.generate_character_from_image(self.input_image_path)
            
            # UIスレッドで結果を更新
            self.root.after(0, lambda: self._update_ui_with_result(output_image, character_description))
        except Exception as e:
            print(f"処理エラー: {e}")
            import traceback
            traceback.print_exc()
            # エラーが発生した場合もUIを更新
            self.root.after(0, lambda: self._handle_error(str(e)))
    
    def _update_ui_with_result(self, output_image, character_description):
        # アプリケーションが破棄されている場合は処理を中断
        if self.is_destroyed:
            return
            
        try:
            print("UI更新を開始します")
            self.output_image = output_image
            self.character_description = character_description
            
            # ステータス更新
            if not self.is_destroyed:
                self.status_label.config(text="画像を表示中...")
                self.root.update_idletasks()
                self.root.update()
            
            # 結果を表示
            if not self.is_destroyed:
                self.display_output_image()
            
            # 各UI要素を段階的に更新し、macOSのUI更新問題を回避
            if not self.is_destroyed:
                self.root.update_idletasks()
                self.root.update()
            
            if not self.is_destroyed:
                self.save_btn.config(state=NORMAL)
                self.root.update_idletasks()
            
            if not self.is_destroyed:
                self.status_label.config(text="説明を表示中...")
                self.root.update_idletasks()
                self.root.update()
            
            # 説明テキストを表示
            if not self.is_destroyed:
                self.description_text.config(state=NORMAL)
                self.description_text.delete(1.0, END)
                self.description_text.insert(END, self.character_description)
                self.description_text.config(state=DISABLED)
            
            # 最終的なUI更新
            if not self.is_destroyed:
                self.root.update_idletasks()
                self.root.update()
            
            # ボタンを再び有効化
            if not self.is_destroyed:
                self.convert_btn.config(state=NORMAL)
                self.status_label.config(text="変換完了")
            
            # macOS特有の問題に対処するための追加の更新
            if not self.is_destroyed:
                self.root.lift()  # ウィンドウを前面に
                self.root.attributes('-topmost', True)
                self.root.after(100, lambda: self.root.attributes('-topmost', False) if not self.is_destroyed else None)
                
                self.root.update_idletasks()
                self.root.update()
            
            print("UI更新が完了しました")
            
        except Exception as e:
            print(f"UI更新エラー: {e}")
            import traceback
            traceback.print_exc()
            self._handle_error(str(e))
    
    def _handle_error(self, error_message):
        if self.is_destroyed:
            return
            
        try:
            from tkinter import messagebox
            messagebox.showerror("エラー", f"変換中にエラーが発生しました: {error_message}")
            if not self.is_destroyed:
                self.status_label.config(text="エラーが発生しました")
                self.convert_btn.config(state=NORMAL)
        except Exception:
            pass  # アプリが破棄済みの場合はエラーを無視
    
    def generate_character_from_image(self, image_path):
        print(f"generate_character_from_image が呼び出されました: {image_path}")
        # 画像を読み込み
        img = cv2.imread(image_path)
        if img is None:
            print("画像の読み込みに失敗しました")
            return None, "画像の読み込みに失敗しました。"
        
        print(f"画像が正常に読み込まれました。サイズ: {img.shape}")
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
            
            # 象形文字のような画像を生成
            # 白い背景に黒い線で描画
            canvas_size = (500, 500)
            character_img = Image.new('RGB', canvas_size, color='white')
            draw = ImageDraw.Draw(character_img)
            print(f"象形文字用のキャンバスを作成しました: {canvas_size}")
            
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
            
            print(f"描画するポイント数: {len(points)}")
            print(f"ポイント例: {points[:3] if len(points) > 0 else '空のリスト'}")
            
            # 線を太くして象形文字らしく
            for i in range(len(points)):
                start = points[i]
                end = points[(i + 1) % len(points)]
                draw.line([start, end], fill='black', width=5)
            
            print(f"象形文字画像を生成しました: {type(character_img)}, サイズ: {character_img.size}")
            return character_img, description
        else:
            # 輪郭が見つからない場合は元の画像をグレースケールで返す
            pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            file_name = os.path.basename(image_path)
            file_name_without_ext = os.path.splitext(file_name)[0]
            description = self.generate_simple_description(file_name_without_ext)
            return pil_img, description
    
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
    
    def display_output_image(self):
        if self.is_destroyed or not self.output_image:
            return
            
        try:
                # 出力画像をリサイズして表示
                img = self.resize_image_to_fit(self.output_image)
                print(f"リサイズ後の画像サイズ: {img.size}")
                
                self.output_photo = ImageTk.PhotoImage(img)
                self.output_canvas.delete("all")
                
                # キャンバスのサイズを取得
                canvas_width = self.output_canvas.winfo_width()
                canvas_height = self.output_canvas.winfo_height()
                print(f"キャンバスサイズ: {canvas_width}x{canvas_height}")
                
                # キャンバスの中央に画像を配置
                if canvas_width > 1 and canvas_height > 1:  # キャンバスが初期化済みの場合
                    x = canvas_width // 2
                    y = canvas_height // 2
                else:  # キャンバスが初期化されていない場合のデフォルト値
                    x = 200
                    y = 200
                
                print(f"画像配置位置: ({x}, {y})")
                self.output_canvas.create_image(x, y, anchor=CENTER, image=self.output_photo)
                
                # macOSでの画像表示を確実にするための段階的更新
                self.output_canvas.update_idletasks()
                self.root.update_idletasks()
                self.output_canvas.update()
                self.root.update()
                
                # 追加の描画強制
                self.output_canvas.configure(scrollregion=self.output_canvas.bbox("all"))
                self.output_canvas.update_idletasks()
                self.root.update()
                
                print("画像が表示されました")
            except Exception as e:
                print(f"画像表示エラー: {e}")
                import traceback
                traceback.print_exc()
                from tkinter import messagebox
                messagebox.showerror("エラー", f"画像の表示中にエラーが発生しました: {str(e)}")
    
    def save_image(self):
        if not self.output_image:
            from tkinter import messagebox
            messagebox.showwarning("警告", "保存する画像がありません。")
            return
        
        from tkinter import filedialog
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