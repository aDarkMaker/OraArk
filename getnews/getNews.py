import os
import re
import requests
import json
from html import unescape
from urllib.parse import unquote
from datetime import datetime

# 配置参数
USER_ID = "6279793937"  
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
    'Referer': f'https://m.weibo.cn/u/{USER_ID}'
}
SAVE_DIR = os.path.join(os.path.dirname(__file__), 'News', 'wbpro')


def get_container_id():
    """获取containerid"""
    url = f"https://m.weibo.cn/api/container/getIndex?type=uid&value={USER_ID}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code == 200:
        data = response.json()
        for tab in data['data']['tabsInfo']['tabs']:
            if tab['tab_type'] == 'weibo':
                return tab['containerid']
    return f"107603{USER_ID}"  


def clean_html_tags(text):
    """清理HTML标签并转义字符"""
    text = unescape(text)
    # 替换微博表情为文字描述
    text = re.sub(r'<span class="url-icon"><img.*?alt="(.*?)".*?</span>', r'\1', text)
    # 移除其他HTML标签
    return re.sub(r'<.*?>', '', text)


def fetch_full_weibo(weibo_id):
    """获取完整微博内容"""
    url = f"https://m.weibo.cn/statuses/show?id={weibo_id}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code == 200:
        data = response.json()
        return clean_html_tags(data['data']['text'])
    return None


def fetch_weibo_data(containerid):
    """获取微博数据"""
    url = f"https://m.weibo.cn/api/container/getIndex?containerid={containerid}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        return None
    
    data = response.json()
    weibo_list = []
    
    for card in data['data']['cards']:
        if card['card_type'] == 9:  # 只处理微博卡片
            mblog = card['mblog']
            # 处理文本内容
            text = clean_html_tags(mblog['text'])
            if '全文' in text:
                text = fetch_full_weibo(mblog['id']) or text
            # 处理图片
            pics = []
            if 'pics' in mblog:
                for pic in mblog['pics']:
                    # 获取原图URL
                    if 'large' in pic:
                        pics.append(pic['large']['url'])
                    elif 'url' in pic:
                        pics.append(pic['url'])
            
            # 处理视频
            video_url = None
            if 'page_info' in mblog and mblog['page_info'].get('type') == 'video':
                video_url = mblog['page_info']['media_info']['stream_url']
            
            # 获取微博创建时间
            created_at = mblog.get('created_at', '')
            
            weibo_list.append({
                'id': mblog['id'],
                'text': text,
                'pics': pics,
                'video': video_url,
                'time': created_at
            })
    
    # 按时间排序，最新的微博在最前面
    weibo_list.sort(key=lambda x: datetime.strptime(x['time'], '%a %b %d %H:%M:%S %z %Y'), reverse=True)
    
    return weibo_list


def save_content(weibo):
    """保存内容到本地"""
    try:
        os.makedirs(SAVE_DIR, exist_ok=True)
        base_name = f"{weibo['time'].replace(' ', '_').replace(':', '_')}_{weibo['id']}"
        
        # 保存文本
        if weibo['text']:
            txt_path = os.path.join(SAVE_DIR, f"{base_name}.txt")
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(weibo['text'])
        
        # 下载图片
        for idx, pic_url in enumerate(weibo['pics'], 1):
            try:
                response = requests.get(pic_url, headers=HEADERS, stream=True)
                if response.status_code == 200:
                    # 获取图片扩展名
                    ext = 'jpg'
                    if 'format' in pic_url:
                        ext = unquote(pic_url).split('format=')[1].split('&')[0]
                    elif '.' in pic_url:
                        ext = pic_url.split('.')[-1].split('?')[0]
                    
                    pic_path = os.path.join(SAVE_DIR, f"{base_name}_{idx}.{ext}")
                    with open(pic_path, 'wb') as f:
                        for chunk in response.iter_content(1024):
                            f.write(chunk)
                    print(f"图片下载成功：{pic_url}")
                else:
                    print(f"图片下载失败，状态码：{response.status_code}，URL：{pic_url}")
            except Exception as e:
                print(f"下载图片失败：{pic_url}\n错误信息：{str(e)}")
        
        # 下载视频
        if weibo.get('video'):
            try:
                response = requests.get(weibo['video'], headers=HEADERS, stream=True)
                if response.status_code == 200:
                    video_path = os.path.join(SAVE_DIR, f"{base_name}.mp4")
                    with open(video_path, 'wb') as f:
                        for chunk in response.iter_content(1024):
                            f.write(chunk)
                    print(f"视频下载成功：{weibo['video']}")
                else:
                    print(f"视频下载失败，状态码：{response.status_code}，URL：{weibo['video']}")
            except Exception as e:
                print(f"下载视频失败：{weibo['video']}\n错误信息：{str(e)}")

    except Exception as e:
        print(f"保存内容时发生错误：{str(e)}")


def main():
    # 获取containerid
    containerid = get_container_id()
    print(f"获取到containerid: {containerid}")
    
    # 获取微博数据
    weibo_list = fetch_weibo_data(containerid)
    if not weibo_list:
        print("未获取到微博数据")
        return
    
    # 打印获取到的微博信息列表
    # for weibo in weibo_list:
        # print(f"微博ID: {weibo['id']}, 时间: {weibo['time']}, 内容: {weibo['text'][:30]}...")

    # 只处理最新
    latest_weibo = weibo_list[0]
    print(f"获取到最新微博：{latest_weibo['time']}")
    
    # 保存内容
    save_content(latest_weibo)
    print("内容保存完成")


if __name__ == "__main__":
    main()