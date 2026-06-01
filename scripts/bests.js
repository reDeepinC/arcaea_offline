const B30_SIZE = 30;
const OVERFLOW_SIZE = 30;
const BESTS_LIMIT = B30_SIZE + OVERFLOW_SIZE;

const CLASS_BORDER = {
    Past: '#0077ff',
    Present: '#01b73a',
    Future: '#B056FF',
    Beyond: '#db004f',
    Eternal: '#5f63ff',
};

function formatScore(score) {
    const digits = String(Math.floor(Number(score) || 0)).padStart(8, '0').slice(-8);
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function illustrationUrl(id, songClass) {
    return songClass === 'Beyond' ? `${id}_byd` : id;
}

function createBestCard(entry, rank) {
    const card = document.createElement('div');
    card.className = 'best-card';
    const borderColor = CLASS_BORDER[entry.class] || CLASS_BORDER.Future;
    card.style.borderColor = borderColor;

    const name = document.createElement('div');
    name.className = 'best-card-name';
    name.textContent = `#${rank} ${entry.name}`;

    const img = document.createElement('img');
    img.className = 'best-card-cover';
    img.src = `/assets/illustrations/${illustrationUrl(entry.id, entry.class)}.jpg`;
    img.alt = entry.name;

    const scoreEl = document.createElement('div');
    scoreEl.className = 'best-card-score';
    scoreEl.textContent = formatScore(entry.score);

    const constantEl = document.createElement('div');
    constantEl.className = 'best-card-constant';
    constantEl.textContent = parseFloat(entry.difficulty).toFixed(1);

    const ptEl = document.createElement('div');
    ptEl.className = 'best-card-pt';
    ptEl.textContent = parseFloat(entry.rating).toFixed(3);

    card.append(name, img, scoreEl, constantEl, ptEl);
    return card;
}

function fillBestsBoard(board, entries, startRank) {
    board.innerHTML = '';
    let row = null;
    entries.forEach((entry, i) => {
        if (i % 15 === 0) {
            row = document.createElement('div');
            row.className = 'bests-row';
            board.appendChild(row);
        }
        row.appendChild(createBestCard(entry, startRank + i));
    });
}

function get_username() {
    fetch('/username', {
        method: 'GET',
    })
        .then((response) => response.json())
        .then((data) => {
            document.querySelector('.username').textContent = data.username;
        })
        .catch(() => {});
}

function get_bests() {
    fetch(`/get_bests?limit=${BESTS_LIMIT}`, {
        method: 'GET',
    })
        .then((response) => response.json())
        .then((data) => {
            const valid = [];
            for (let i = 0; i < data.length; i++) {
                if (data[i].rating == 0) break;
                valid.push(data[i]);
            }

            let best30 = 0;
            let recent10 = 0;
            const best30Entries = valid.slice(0, B30_SIZE);
            best30Entries.forEach((entry, i) => {
                best30 += entry.rating;
                if (i < 10) recent10 += entry.rating;
            });

            fillBestsBoard(document.getElementById('bests-board'), best30Entries, 1);

            const overflowEntries = valid.slice(B30_SIZE, B30_SIZE + OVERFLOW_SIZE);
            fillBestsBoard(document.getElementById('overflow-board'), overflowEntries, B30_SIZE + 1);

            best30 = (best30 / B30_SIZE).toFixed(3);
            recent10 = (recent10 / 10).toFixed(3);
            document.querySelector('.best-30').textContent = `Best 30: ${best30}`;
            document.querySelector('.recent-10').textContent = `Recent 10: ${recent10}`;
            document.querySelector('.max-potential').textContent = `Max Potential: ${(best30 * 0.75 + recent10 * 0.25).toFixed(3)}`;

            const maxptt = best30 * 0.75 + recent10 * 0.25;
            const rankRating = document.querySelector('.rank-rating');
            rankRating.innerHTML = '';
            const p = document.createElement('p');
            const p1 = document.createElement('p');
            const p2 = document.createElement('p');
            p.style.display = 'flex';
            p.style.alignItems = 'end';
            p.style.flexDirection = 'row';
            p1.textContent = `${maxptt.toString().slice(0, maxptt.toString().indexOf('.'))}.`;
            p1.textContent = p1.textContent == '.' ? '0.' : p1.textContent;
            p1.style.webkitTextStroke = '0.3px black';
            p2.textContent = maxptt
                .toString()
                .slice(maxptt.toString().indexOf('.') + 1, maxptt.toString().indexOf('.') + 3);
            p2.style.webkitTextStroke = '0.2px black';
            p1.style.fontSize = '20px';
            p2.style.fontSize = '17px';
            p1.style.margin = '0px';
            p1.style.padding = '0px';
            p1.style.position = 'relative';
            p1.style.bottom = '1px';
            p2.style.position = 'relative';
            p2.style.bottom = '2px';
            p2.style.margin = '0px';
            p2.style.padding = '0px';
            p.appendChild(p1);
            p.appendChild(p2);
            rankRating.appendChild(p);

            const rankImg = document.querySelector('.rank-img');
            if (maxptt >= 13.0) rankImg.src = '/assets/others/rating_7.png';
            else if (maxptt >= 12.5) rankImg.src = '/assets/others/rating_6.png';
            else if (maxptt >= 12.0) rankImg.src = '/assets/others/rating_5.png';
            else if (maxptt >= 11.0) rankImg.src = '/assets/others/rating_4.png';
            else if (maxptt >= 10.0) rankImg.src = '/assets/others/rating_3.png';
            else if (maxptt >= 7.0) rankImg.src = '/assets/others/rating_2.png';
            else if (maxptt >= 3.5) rankImg.src = '/assets/others/rating_1.png';
            else rankImg.src = '/assets/others/rating_0.png';
        })
        .catch((error) => console.log(error));
}

function avatar_list_toggle() {
    const avatar_list = document.querySelector('.avatar-list');
    if (avatar_list.style.opacity == 1) {
        avatar_list.style.opacity = 0;
        avatar_list.style.zIndex = -10;
    } else {
        avatar_list.style.opacity = 1;
        avatar_list.style.zIndex = 1000;
        fetch('/avatar_list', {
            method: 'GET',
        })
            .then((response) => response.json())
            .then((data) => {
                const avatar_list = document.querySelector('.avatar-list');
                avatar_list.innerHTML = '';
                for (let i = 0; i < data.length; i++) {
                    if (data[i] == '.gitkeep') continue;
                    const img = document.createElement('img');
                    img.src = '/assets/avatars/' + data[i];
                    img.onclick = function () {
                        avatar_list.style.opacity = 0;
                        avatar_list.style.zIndex = -10;
                        document.querySelector('.avatar img').src = this.src;
                        fetch('/set_avatar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ avatar: data[i] }),
                        }).catch((error) => console.log(error));
                    };
                    avatar_list.appendChild(img);
                }
            });
    }
}

function get_avatar() {
    fetch('/get_avatar', {
        method: 'GET',
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.avatar == 'default.png') {
                document.querySelector('.avatar img').src = '/assets/others/' + data.avatar;
            } else {
                document.querySelector('.avatar img').src = '/assets/avatars/' + data.avatar;
            }
        })
        .catch((error) => console.log(error));
}

get_username();
get_avatar();
get_bests();
