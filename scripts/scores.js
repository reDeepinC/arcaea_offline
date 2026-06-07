const CARDS_PER_ROW = 15;
const MAX_CONSTANT_TIER = 12.0;

const CLASS_BORDER = {
    Past: '#0077ff',
    Present: '#01b73a',
    Future: '#B056FF',
    Beyond: '#8b1a3a',
    Eternal: '#4a6b80',
};

function calcptt(difficulty, score) {
    if (score == '' || !score) {
        return 0;
    }
    if (score >= 1000_0000) {
        return difficulty + 2;
    }
    if (score >= 980_0000) {
        return difficulty + 1 + (score - 980_0000) / 20_0000;
    }
    return Math.max(difficulty + (score - 950_0000) / 30_0000, 0);
}

function illustrationUrl(id, songClass) {
    return songClass === 'Beyond' ? `${id}_byd` : id;
}

function constantKey(difficulty) {
    return parseFloat(difficulty).toFixed(1);
}

function getFilterBounds() {
    return {
        min: parseFloat(document.getElementById('minDifficulty').innerText),
        max: parseFloat(document.getElementById('maxDifficulty').innerText),
    };
}

function calcDaysAgo(dateStr) {
    if (!dateStr) return '-';
    const then = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - then) / (1000 * 60 * 60 * 24));
    return diff + 'd';
}

function createScoreCard(entry, onScoreSaved, rank) {
    const card = document.createElement('div');
    card.className = 'score-card';
    card.style.borderColor = CLASS_BORDER[entry.class] || CLASS_BORDER.Future;

    const name = document.createElement('div');
    name.className = 'score-card-name';
    name.textContent = entry.title;
    name.title = entry.title;

    const img = document.createElement('img');
    img.className = 'score-card-cover';
    img.src = `/assets/illustrations/${illustrationUrl(entry.id, entry.class)}.jpg`;
    img.alt = entry.title;

    const scoreInput = document.createElement('input');
    scoreInput.type = 'number';
    scoreInput.className = 'score-card-input';
    scoreInput.min = '0';
    scoreInput.step = '1';
    scoreInput.value = entry.score || 0;

    const rankEl = document.createElement('div');
    rankEl.className = 'score-card-rank';
    if (entry.score && entry.score != 0 && rank) {
        rankEl.textContent = `#${rank}`;
    } else {
        rankEl.textContent = '-';
    }

    const ptEl = document.createElement('div');
    ptEl.className = 'score-card-pt';
    ptEl.textContent = calcptt(entry.difficulty, entry.score).toFixed(3);

    const infoRow1 = document.createElement('div');
    infoRow1.className = 'score-card-info-row';
    infoRow1.append(rankEl, ptEl);

    const daysEl = document.createElement('span');
    daysEl.className = 'score-card-days';
    daysEl.textContent = calcDaysAgo(entry.last_updated);

    const playCountEl = document.createElement('span');
    playCountEl.className = 'score-card-play-count';
    playCountEl.textContent = (entry.play_count || 0) + 'pc';

    const plusBtn = document.createElement('button');
    plusBtn.className = 'score-card-plus-btn';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        fetch('/increment_play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: entry.id, class: entry.class }),
        })
            .then(() => {
                entry.play_count = (entry.play_count || 0) + 1;
                playCountEl.textContent = entry.play_count + 'pc';
            })
            .catch((error) => console.log(error));
    });

    const playWrap = document.createElement('span');
    playWrap.className = 'score-card-play';
    playWrap.append(playCountEl, plusBtn);

    const infoRow2 = document.createElement('div');
    infoRow2.className = 'score-card-info-row-2';
    infoRow2.append(daysEl, playWrap);

    const RANK_COLOR_DARK_CYAN = '#00CED1';
    const RANK_COLOR_LIGHT_PURPLE = '#D8B4FF';
    if (rank && rank <= 30) {
        card.style.background = 'rgba(0, 206, 209, 0.4)';
        rankEl.style.color = RANK_COLOR_DARK_CYAN;
        ptEl.style.color = RANK_COLOR_DARK_CYAN;
    } else if (rank && rank <= 60) {
        card.style.background = 'rgba(216, 180, 255, 0.4)';
        rankEl.style.color = RANK_COLOR_LIGHT_PURPLE;
        ptEl.style.color = RANK_COLOR_LIGHT_PURPLE;
    }

    scoreInput.addEventListener('change', function () {
        const score = this.value;
        entry.score = score;
        entry.rating = calcptt(entry.difficulty, score);
        ptEl.textContent = entry.rating.toFixed(3);
        fetch('/update_chart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: entry.id,
                class: entry.class,
                score: score,
            }),
        })
            .then(() => onScoreSaved && onScoreSaved())
            .catch((error) => console.log(error));
    });

    if (entry.difficulty >= 11.0) {
        card.style.position = 'relative';
        const badge = document.createElement('div');
        badge.textContent = entry.difficulty.toFixed(1);
        badge.style.cssText = 'position:absolute;top:2px;left:2px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.85);background:rgba(0,0,0,0.55);padding:1px 4px;border-radius:3px;z-index:1;line-height:1.4;pointer-events:none;';
        card.appendChild(badge);
    }

    card.append(name, img, scoreInput, infoRow1, infoRow2);
    return card;
}

function autoFitFontSize(el) {
    el.style.fontSize = '14.3px';
    if (el.scrollHeight <= el.clientHeight) return;
    for (let size = 14; size >= 7; size -= 0.5) {
        el.style.fontSize = size + 'px';
        if (el.scrollHeight <= el.clientHeight) break;
    }
}

function groupByConstant(data) {
    const groups = new Map();
    for (const item of data) {
        const key = constantKey(item.difficulty);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(item);
    }
    return groups;
}

function renderSection(labelText, tierEntries, rankMap, rerender, cardsWrap) {
    const label = document.createElement('div');
    label.className = 'constant-label';
    label.textContent = labelText;
    const wrap = cardsWrap || document.createElement('div');
    wrap.className = 'constant-cards';

    const flatSongs = [];
    for (const { songs } of tierEntries) {
        for (const song of songs) {
            flatSongs.push(song);
        }
    }

    for (let i = 0; i < flatSongs.length; i += CARDS_PER_ROW) {
        const row = document.createElement('div');
        row.className = 'cards-row';
        flatSongs.slice(i, i + CARDS_PER_ROW).forEach((entry) => {
            const rank = rankMap.get(`${entry.id}_${entry.class}`);
                const card = createScoreCard(entry, rerender, rank);
                row.appendChild(card);
            });
        wrap.appendChild(row);
    }

    if (!cardsWrap) {
        const section = document.createElement('div');
        section.className = 'constant-section';
        section.append(label, wrap);
        return section;
    }
    return { label, wrap };
}

function renderScoresBoard(data) {
    const board = document.getElementById('scores-board');
    board.innerHTML = '';
    const { min, max } = getFilterBounds();
    const groups = groupByConstant(data);

    const rerender = () => renderScoresBoard(data);

    const ranked = [...data].sort((a, b) => Number(b.rating) - Number(a.rating));
    const rankMap = new Map();
    ranked.forEach((entry, idx) => {
        rankMap.set(`${entry.id}_${entry.class}`, idx + 1);
    });

    const MERGE_THRESHOLD = 11.0;
    const mergedTiers = [];
    const regularTiers = [];

    for (let tier = Math.round(MAX_CONSTANT_TIER * 10); tier >= Math.round(min * 10); tier--) {
        const constant = tier / 10;
        if (constant > max + 0.001) continue;
        const key = constant.toFixed(1);
        const songs = groups.get(key);
        if (!songs || songs.length === 0) continue;
        songs.sort((a, b) => Number(b.score) - Number(a.score));
        (constant >= MERGE_THRESHOLD ? mergedTiers : regularTiers).push({ key, songs });
    }

    if (mergedTiers.length > 0) {
        const wrap = document.createElement('div');
        wrap.className = 'constant-cards';
        const { label } = renderSection('11.+', mergedTiers, rankMap, rerender, wrap);
        const section = document.createElement('div');
        section.className = 'constant-section';
        section.append(label, wrap);
        board.appendChild(section);
    }

    for (const entry of regularTiers) {
        board.appendChild(renderSection(entry.key, [entry], rankMap, rerender));
    }

    requestAnimationFrame(() => {
        document.querySelectorAll('.score-card-name').forEach(autoFitFontSize);
    });
    bindScoreInputNavigation();
}

function bindScoreInputNavigation() {
    const inputs = document.querySelectorAll('.score-card-input');
    inputs.forEach((input, index) => {
        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'ArrowDown') {
                event.preventDefault();
                if (index + 1 < inputs.length) {
                    inputs[index + 1].focus();
                }
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (index - 1 >= 0) {
                    inputs[index - 1].focus();
                }
            }
        });
    });
}

function update_chart(data) {
    renderScoresBoard(data);
}

function get_chart() {
    fetch('/get_chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full: true }),
    })
        .then((response) => response.json())
        .then((data) => {
            update_chart(data);
        })
        .catch((error) => console.log(error));
}

function export_chart() {
    fetch('/export_chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    })
        .catch((error) => {
            alert('Ops : (');
            console.log(error);
        });
}

function import_chart() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.style.display = 'none';
    input.addEventListener('change', () => {
        const file = input.files[0];
        const formdata = new FormData();
        formdata.append('file', file);
        if (!confirm('导入成绩会覆盖掉原本数据，确定要导入吗？')) {
            return;
        }
        fetch('/import_chart', {
            method: 'POST',
            body: formdata,
        })
            .then((response) => response.json())
            .then(() => {
                window.location.reload();
            })
            .catch((error) => console.log(error));
    });
    input.click();
}

function get_difficulty(difficulty, elementID) {
    document.getElementById(elementID).innerText = parseFloat(difficulty).toFixed(1);
}

function apply_sorter() {
    const minDifficulty = parseFloat(document.getElementById('minDifficulty').innerText);
    const maxDifficulty = parseFloat(document.getElementById('maxDifficulty').innerText);
    const sorter = document.getElementById('sorter').value;
    fetch('/apply_sorter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            minDifficulty: minDifficulty,
            maxDifficulty: maxDifficulty,
            sorter: sorter,
            classes: {
                Past: document.getElementById('Past').innerHTML.includes('<i class="fa fa-check"></i>'),
                Present: document.getElementById('Present').innerHTML.includes('<i class="fa fa-check"></i>'),
                Future: document.getElementById('Future').innerHTML.includes('<i class="fa fa-check"></i>'),
                Beyond: document.getElementById('Beyond').innerHTML.includes('<i class="fa fa-check"></i>'),
                Eternal: document.getElementById('Eternal').innerHTML.includes('<i class="fa fa-check"></i>'),
            },
        }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data && data.success === false) {
                return;
            }
            update_chart(data);
        })
        .catch((error) => console.log(error));
}

function select_class(elementID) {
    const element = document.getElementById(elementID);
    if (element.innerHTML.includes('<i class="fa fa-check"></i>')) {
        element.innerHTML = `${elementID}`;
    } else {
        element.innerHTML = `${elementID} <i class="fa fa-check"></i>`;
    }
}

apply_sorter();
