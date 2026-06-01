const CARDS_PER_ROW = 15;
const MAX_CONSTANT_TIER = 12.0;

const CLASS_BORDER = {
    Past: '#0077ff',
    Present: '#01b73a',
    Future: '#B056FF',
    Beyond: '#db004f',
    Eternal: '#5f63ff',
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

function createScoreCard(entry, onScoreSaved) {
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

    const ptEl = document.createElement('div');
    ptEl.className = 'score-card-pt';
    ptEl.textContent = calcptt(entry.difficulty, entry.score).toFixed(3);

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

    card.append(name, img, scoreInput, ptEl);
    return card;
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

function renderScoresBoard(data) {
    const board = document.getElementById('scores-board');
    board.innerHTML = '';
    const { min, max } = getFilterBounds();
    const groups = groupByConstant(data);

    const rerender = () => renderScoresBoard(data);

    for (let tier = Math.round(MAX_CONSTANT_TIER * 10); tier >= Math.round(min * 10); tier--) {
        const constant = tier / 10;
        if (constant > max + 0.001) {
            continue;
        }
        const key = constant.toFixed(1);
        const songs = groups.get(key);
        if (!songs || songs.length === 0) {
            continue;
        }
        songs.sort((a, b) => Number(b.score) - Number(a.score));

        const section = document.createElement('div');
        section.className = 'constant-section';

        const label = document.createElement('div');
        label.className = 'constant-label';
        label.textContent = key;

        const cardsWrap = document.createElement('div');
        cardsWrap.className = 'constant-cards';

        for (let i = 0; i < songs.length; i += CARDS_PER_ROW) {
            const row = document.createElement('div');
            row.className = 'cards-row';
            songs.slice(i, i + CARDS_PER_ROW).forEach((entry) => {
                row.appendChild(createScoreCard(entry, rerender));
            });
            cardsWrap.appendChild(row);
        }

        section.append(label, cardsWrap);
        board.appendChild(section);
    }

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
        .then(() => alert('done : )'))
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
                alert('done : )');
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
