import random
from flask import *
from flask_socketio import *
import hashlib
from dotenv import *
import secrets
import os
from gevent import pywsgi
import sqlite3
from colorama import Fore, init
import pandas as pd
import numpy as np
import datetime

load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
init(autoreset=True)
curdir = os.path.dirname(os.path.abspath(__file__))
BEST30_COUNT = 30
OVERFLOW_COUNT = 30
BESTS_RETURN_LIMIT = int(os.getenv('BESTS_RETURN_LIMIT', BEST30_COUNT + OVERFLOW_COUNT))
# Default user for sessions (used after removing authentication)
# Determine default user: use environment variable if set,
# otherwise fall back to the first existing username in the database
def _resolve_default_user():
    env_user = os.getenv('DEFAULT_USER')
    if env_user:
        return env_user
    # Try to fetch an existing username from the Songs table
    db_path = os.path.join(curdir, os.getenv('DB_PATH'))
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT DISTINCT username FROM songs LIMIT 1')
        row = cursor.fetchone()
        conn.close()
        if row and row[0]:
            return row[0]
    except Exception:
        pass
    # Fallback default
    return 'default_user'

default_user = _resolve_default_user()
chartconstant = {}
songlist = {}
class_song = [
    "Past",
    'Present',
    'Future',
    'Beyond',
    'Eternal',
]
class2num = {
    "Past": 0,
    'Present': 1,
    'Future': 2,
    'Beyond': 3,
    'Eternal': 4,
}

with open(os.path.join(curdir, os.getenv('SONGLIST_PATH'))) as file:
    songlist = json.load(file)

with open(os.path.join(curdir, os.getenv('CHARTCONSTANT_PATH'))) as file:
    chartconstant = json.load(file)

def hash(password):
    sha256 = hashlib.sha256()
    sha256.update(password.encode('utf-8'))
    return sha256.hexdigest()

def calcRating(difficulty, score):
    if score == '' or not score:
        return 0
    if score >= 1000_0000:
        return difficulty + 2
    elif score >= 980_0000:
        return difficulty + 1 + (score - 980_0000) / 20_0000
    else:
        return max(difficulty + (score - 950_0000) / 30_0000, 0)

@app.route('/')
def index():
    # Redirect to the scores management page (default user)
    return redirect('/scores')

@app.route('/<path:path>')
def route(path):
    if os.path.isfile(os.path.join(curdir, 'public',f'{path}.html')):
        return send_from_directory(os.path.join(curdir, 'public'),f'{path}.html')
    else:
        return send_from_directory(os.path.join(curdir, 'public'),"404.html")
    
@app.route('/scripts/<path:file>')
def scripts(file):
    if os.path.isfile(os.path.join(curdir, 'scripts',f'{file}')):
        return send_from_directory(os.path.join(curdir, 'scripts'),f'{file}')
    else:
        print(Fore.RED + f'Error: {file} not found')
        Fore.WHITE
        return None
    
@app.route('/style/<path:file>')
def stylesheets(file):
    if os.path.isfile(os.path.join(curdir, 'style',f'{file}')):
        return send_from_directory(os.path.join(curdir, 'style'),f'{file}')
    else:
        print(Fore.RED + f'Error: {file} not found')
        Fore.WHITE
        return None
    
@app.route('/template/<path:file>', methods=['GET'])
def templates(file):
    if os.path.isfile(os.path.join(curdir, 'template',f'{file}.html')):
        return send_from_directory(os.path.join(curdir, 'template'),f'{file}.html')
    else:
        print(Fore.RED + f'Error: {file}.html not found')
        Fore.WHITE
        return None
    
# Login endpoint removed – authentication disabled.
    
@app.route('/assets/<path:file>')
def serve_asset(file):
    file = file.replace('&', '%26')
    if os.path.isfile(os.path.join('./assets',file)):
        return send_from_directory('./assets',file)
    file = file.replace('_byd', '')
    return send_from_directory('./assets', file)

@app.route('/favicon.ico')
def serve_favicon():
    return send_from_directory('./','favicon.ico')

# Registration endpoint removed – user management disabled.

# Username endpoint removed – authentication disabled.

def _build_chart_data(username):
    conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
    cursor = conn.cursor()
    cursor.execute('''SELECT * from songs WHERE username = ?''', (username,))
    rows = cursor.fetchall()
    conn.close()
    data = []
    for song in songlist['songs']:
        if song['id'] not in chartconstant:
            continue
        chart = chartconstant[song['id']]
        for index in range(len(chart)):
            if not chart[index]:
                continue
            res = [item for item in rows if item[0] == song['id'] and item[1] == class_song[index] and item[3] == username]
            data.append({
                'id': song['id'],
                'title': song['title_localized']['en'],
                'artist': song['artist'],
                'difficulty': chart[index]['constant'],
                'class': class_song[index],
                'score': res[0][2] if len(res) == 1 else 0,
                'rating': calcRating(chart[index]['constant'], res[0][2] if len(res) == 1 else 0)
            })
    return data

@app.route('/get_chart', methods=['POST'])
def get_chart():
    body = request.get_json(silent=True) or {}
    data = _build_chart_data(default_user)
    if not body.get('full'):
        data.sort(key=lambda x: x['difficulty'])
        data = data[::-1][:int(os.getenv('MAX_SONG_LOADED'))][::-1]
    return jsonify(data)

@app.route('/update_chart', methods=['POST'])
def update_chart():
    # Update chart for the default user (authentication removed)
    data = request.get_json()
    if data.get('score') == '':
        data['score'] = 0
    print(Fore.GREEN + f'{data}')
    Fore.WHITE
    conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO songs VALUES (?, ?, ?, ?);
        ''',
        (data.get('id'), data.get('class'), data.get('score'), default_user)
    )
    conn.commit()
    conn.close()
    print('Chart updated!')
    return jsonify({'success': True})

@app.route('/get_bests', methods=['GET'])
def get_bests():
    # Retrieve best charts for the default user
    conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
    cursor = conn.cursor()
    cursor.execute('''SELECT * from songs WHERE username = ?''', (default_user,))
    rows = cursor.fetchall()
    data = []
    for row in rows:
        data.append({
            'id': row[0],
            'name': next(song for song in songlist['songs'] if song['id'] == row[0])['title_localized']['en'],
            'class': row[1],
            'difficulty': chartconstant[row[0]][class2num[row[1]]]['constant'],
            'score': row[2],
            'rating': round(calcRating(chartconstant[row[0]][class2num[row[1]]]['constant'], row[2]), 3)
        })
    data.sort(key=lambda x: x['rating'], reverse=True)
    conn.close()
    limit = request.args.get('limit', type=int)
    if limit is None:
        limit = BESTS_RETURN_LIMIT
    limit = max(1, min(limit, len(data)))
    return jsonify(data[:limit])

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    # id == 0 : random recommendation
    if data.get('id') == 0:
        df = pd.read_csv(os.path.join(curdir, os.getenv('RECOMMEND_PATH')))
        df = df.to_numpy().flatten().tolist()
        return jsonify({'message': df[random.randint(0, len(df)-1)]})
    # id == 1 : recommend based on user charts (default_user)
    elif data.get('id') == 1:
        conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
        cursor = conn.cursor()
        cursor.execute('''SELECT * from songs WHERE username = ?''', (default_user,))
        rows = cursor.fetchall()
        conn.close()
        data_list = []
        for row in rows:
            data_list.append({
                'id': row[0],
                'name': next(song for song in songlist['songs'] if song['id'] == row[0])['title_localized']['en'],
                'class': row[1],
                'difficulty': chartconstant[row[0]][class2num[row[1]]]['constant'],
                'score': row[2],
                'rating': round(calcRating(chartconstant[row[0]][class2num[row[1]]]['constant'], row[2]), 3)
            })
        data_list.sort(key=lambda x: x['rating'], reverse=True)
        if len(data_list) < 40:
            return jsonify({'message': "歌都没打几首，急着推分作甚？"})
        else:
            idx = random.randint(30, 39)
            return jsonify({'message': f"推荐这首{data_list[idx]['name']}！目前的得分为{int(data_list[idx]['score'])}，不过不要强推，小心手癖！"})
    # id == 2 : random bible quote
    elif data.get('id') == 2:
        df = pd.read_csv(os.path.join(curdir, os.getenv('BIBLE_PATH')))
        df = df.to_numpy().flatten().tolist()
        return jsonify({'message': df[random.randint(0, len(df)-1)]})
    else:
        return jsonify({'message': "爆！"})

# Logout endpoint removed – authentication disabled.

@app.route('/get_avatar', methods=['GET'])
def get_avatar():
    # Return avatar for the default user (no authentication)
    conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
    cursor = conn.cursor()
    cursor.execute('''SELECT * from custom WHERE username = ?''', (default_user,))
    rows = cursor.fetchall()
    if len(rows) == 0:
        conn.close()
        return jsonify({'avatar': 'default.png'})
    else:
        conn.close()
        return jsonify({'avatar': rows[0][1]})

@app.route('/avatar_list', methods=['GET'])
def avatar_list():
    if not session.get('username'):
        return jsonify({'success': False}), 400
    return jsonify(os.listdir('./assets/avatars')), 200

@app.route('/set_avatar', methods=['POST'])
def set_avatar():
    if not session.get('username'):
        return jsonify({'success': False}), 400
    data = request.get_json()
    conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
    cursor = conn.cursor()
    cursor.execute('''INSERT OR REPLACE INTO custom (username, avatar) VALUES (?, ?)''', (session['username'], data.get('avatar')))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/get_p30', methods=['GET'])
def get_p30():
    if not session.get('username'):
        return jsonify({'success': False}), 400
    conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
    cursor = conn.cursor()
    cursor.execute('''SELECT * from songs WHERE username = ?''', (session['username'],))
    rows = cursor.fetchall()
    data = []
    for row in rows:
        if row[2] == '' or int(row[2]) < 1000_0000:
            continue
        data.append({
            'id': row[0],
            'name': next(song for song in songlist['songs'] if song['id'] == row[0])['title_localized']['en'],
            'class': row[1],
            'difficulty': chartconstant[row[0]][class2num[row[1]]]['constant'],
            'score': row[2],
            'rating': round(calcRating(chartconstant[row[0]][class2num[row[1]]]['constant'], row[2]), 3)
        })
    data.sort(key=lambda x: x['rating'], reverse=True)
    conn.close()
    return jsonify(data[:30])

@app.route('/get_max', methods=['GET'])
def get_max():
    data = []
    for song in songlist['songs']:
        if song['id'] not in chartconstant:
            continue
        chart = chartconstant[song['id']]
        for index in range(len(chart)):
            if not chart[index]:
                continue
            data.append({
                'id': song['id'],
                'name': song['title_localized']['en'],
                'artist': song['artist'],
                'difficulty': chart[index]['constant'],
                'class': class_song[index],
                "score": 1000_0616,
                "rating": calcRating(chart[index]['constant'], 1000_0000)
            })
            
    data.sort(key=lambda x: x['difficulty'])
    data = data[::-1]
    return jsonify(data[:30])

@app.route('/export_chart', methods=['POST'])
def export_chart():
    conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
    cursor = conn.cursor()
    cursor.execute('''SELECT * from songs WHERE username = ?''', (default_user,))
    rows = cursor.fetchall()
    data = []
    for row in rows:
        data.append({
            'id': row[0],
            'class': row[1],
            'score': row[2],
        })
    df = pd.DataFrame(data)
    df.to_csv(os.path.join(curdir, os.path.join(os.getenv('EXPORT_PATH')), f'{default_user}_chart_{datetime.date.today()}.csv'), index=False)
    return jsonify({'success': True}), 200

@app.route('/import_chart', methods=['POST'])
def import_chart():
    data = request.files['file']
    print(Fore.GREEN + f'{data}')
    Fore.WHITE
    try:
        df = pd.read_csv(data)
        data = df.to_dict('records')
    except Exception as e:
        print(Fore.RED + f'Error: {e}')
        Fore.WHITE
        return jsonify({'success': False}), 500
    conn = sqlite3.connect(os.path.join(curdir, os.getenv('DB_PATH')))
    cursor = conn.cursor()
    for row in data:
        cursor.execute('''INSERT OR REPLACE INTO songs VALUES (?, ?, ?, ?)''', (row.get('id'), row.get('class'), row.get('score'), default_user))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/apply_sorter', methods=['POST'])
def apply_sorter():
    sorter = request.get_json()
    print(Fore.GREEN + f'{sorter}')
    Fore.WHITE
    data = _build_chart_data(default_user)
    data = [
        song for song in data
        if song['difficulty'] >= float(sorter['minDifficulty'])
        and song['difficulty'] <= float(sorter['maxDifficulty'])
        and sorter['classes'][song['class']]
    ]
    match sorter.get('sorter'):
        case 'byDifficulty':
            data.sort(key=lambda x: x['difficulty'])
        case 'byRating':
            data.sort(key=lambda x: x['rating'])
        case 'byName':
            data.sort(key=lambda x: x['title'], reverse=True)
        case 'byArtist':
            data.sort(key=lambda x: x['artist'], reverse=True)
        case _:
            data.sort(key=lambda x: x['difficulty'])
    return jsonify(data)
    

if __name__ == '__main__':
    print( '==============================================================================================')
    print(r'       _____                                               _____  _____.__  .__               ')
    print(r'      /  _  \_______   ____ _____    ____ _____      _____/ ____\/ ____\  | |__| ____   ____  ')
    print(r'     /  /_\  \_  __ \_/ ___\\__  \ _/ __ \\__  \    /  _ \   __\\   __\|  | |  |/    \_/ __ \ ')
    print(r'    /    |    \  | \/\  \___ / __ \\  ___/ / __ \_ (  <_> )  |   |  |  |  |_|  |   |  \  ___/ ') 
    print(r'    \____|__  /__|    \___  >____  /\___  >____  /  \____/|__|   |__|  |____/__|___|  /\___  >')
    print(r'            \/            \/     \/     \/     \/                                   \/     \/ ')
    print( '==============================================================================================')
    print('ARCAEA OFFLINE IS RUNNING AT http://localhost:5000/')
    server = pywsgi.WSGIServer(('0.0.0.0', int(os.getenv('PORT'))), app)
    server.serve_forever()