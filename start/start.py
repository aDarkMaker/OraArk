import os
import json
import subprocess
import winreg
import win32con
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

script_dir = os.path.dirname(os.path.abspath(__file__))
json_file_path = os.path.join(script_dir, "mumu_path.json")
maa_json_file_path = os.path.join(script_dir, "maa_path.json")

def search_mumu_path_in_registry():
    try:
        reg_key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall")
        for i in range(0, winreg.QueryInfoKey(reg_key)[0]):
            sub_key_name = winreg.EnumKey(reg_key, i)
            sub_key = winreg.OpenKey(reg_key, sub_key_name)
            try:
                display_name = winreg.QueryValueEx(sub_key, "DisplayName")[0]
                if "MuMu" in display_name:
                    install_location = winreg.QueryValueEx(sub_key, "InstallLocation")[0]
                    mumu_path = os.path.join(install_location, "MuMuPlayer.exe")
                    if os.path.exists(mumu_path):
                        return mumu_path
            except FileNotFoundError:
                continue
    except Exception as e:
        print(f"注册表搜索失败: {e}")
    return None

def search_mumu_path_in_directories():
    search_dirs = ["C:\\Program Files", "C:\\Program Files (x86)", "D:\\Program Files", "D:\\Program Files (x86)"]
    for search_dir in search_dirs:
        for root, dirs, files in os.walk(search_dir):
            for file in files:
                if file == "MuMuPlayer.exe":
                    return os.path.join(root, file)
    return None

def get_mumu_path():
    if os.path.exists(json_file_path):
        with open(json_file_path, "r") as file:
            data = json.load(file)
            if data.get("mumu_path"):
                return data["mumu_path"]
    mumu_path = search_mumu_path_in_registry()
    if not mumu_path:
        mumu_path = search_mumu_path_in_directories()
    if mumu_path:
        with open(json_file_path, "w") as file:
            json.dump({"mumu_path": mumu_path}, file)
    return mumu_path

def search_maa_path_in_directories():
    search_dirs = ["C:\\Program Files", "C:\\Program Files (x86)", "D:\\Program Files", "D:\\Program Files (x86)", "D:\\zc\\ZC\\Ark"]
    for search_dir in search_dirs:
        for root, dirs, files in os.walk(search_dir):
            for file in files:
                if file == "MAA.exe":
                    return os.path.join(root, file)
    return None

def get_maa_path():
    if os.path.exists(maa_json_file_path):
        with open(maa_json_file_path, "r") as file:
            data = json.load(file)
            if data.get("maa_path"):
                return data["maa_path"]
    maa_path = search_maa_path_in_directories()
    if maa_path:
        with open(maa_json_file_path, "w") as file:
            json.dump({"maa_path": maa_path}, file)
    return maa_path

def start_mumu():
    mumu_path = get_mumu_path()
    if mumu_path and os.path.exists(mumu_path):
        subprocess.Popen([mumu_path])
        print("MuMu模拟器启动中...")
    else:
        print(f"未找到MuMu模拟器，请检查路径: {mumu_path}")

def start_maa():
    maa_path = get_maa_path()
    if maa_path and os.path.exists(maa_path):
        # 设置启动信息以最小化窗口
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags = subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = win32con.SW_SHOWMINIMIZED
        subprocess.Popen([maa_path], startupinfo=startupinfo, creationflags=subprocess.CREATE_NEW_CONSOLE)
        print("MAA启动中...")
    else:
        print(f"未找到MAA，请检查路径: {maa_path}")

def main():
    start_mumu()
    start_maa()

if __name__ == "__main__":
    main()