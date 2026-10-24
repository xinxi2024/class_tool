import { assignUndercover, compareGuess, drawItems, exportGroups, makeGroups, parseParticipants, randomInt, shuffle } from './core.js';
import { listState, loadState, replaceAllState, saveState } from './store.js';

const app = document.querySelector('#app');
const words = await fetch(new URL('../data/words.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('读取词库失败'); return r.json(); });
const config = await fetch(new URL('../data/config.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('读取配置失败'); return r.json(); });
const routeNames = {home:'概览',groups:'随机分组',lottery:'随机抽签',agenda:'活动流程',undercover:'谁是卧底',draw:'你画我猜',minigames:'小游戏',timer:'计时器',scores:'积分板',poll:'简易投票',bomb:'数字炸弹',settings:'备份与设置'};
const toolCards = [
  ['groups','▦','随机分组','按组数或每组人数均衡分配，可复制和恢复上次结果。','班级组织'],
  ['lottery','⤨','随机抽签','名单抽取、历史记录和不重复模式。','班级组织'],
  ['agenda','☷','活动流程','编辑环节、设置时长、保存与导出活动模板。','班级组织'],
  ['undercover','◉','谁是卧底','本机轮流看词、记录投票轮次并揭晓身份。','趣味游戏'],
  ['bomb','№','数字炸弹','自定义范围、猜测提示和自动缩小范围。','趣味游戏'],
  ['draw','✎','你画我猜','随机题目、难度筛选、倒计时和自定义词库。','趣味游戏'],
  ['minigames','✳','小游戏','逛三园、海龟汤、猜歌、接龙和数字 7。','趣味游戏'],
  ['timer','◷','现场计时器','正计时或倒计时，支持暂停和全屏展示。','现场互动'],
  ['scores','＋','通用积分板','自定义组名和分数，调整、排序并自动保存。','现场互动'],
  ['poll','▤','简易投票','单设备现场录票，查看票数和比例图表。','现场互动'],
  ['settings','⇧','备份与恢复','导出本地数据，导入备份或恢复默认设置。','通用工具']
];
let route = 'home'; let toastTimer; let spyHideTimer; let audioUrl = null; let ticking = null; let lastFocus = null;

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const state = (key, fallback) => loadState(key, fallback);
function save(key, value) { if (!saveState(key, value)) notify('本机存储不可用或空间不足；本次内容可能无法在刷新后恢复。', true); }
function notify(message, warning = false) { const toast = $('#toast'); toast.textContent = message; toast.classList.toggle('danger', warning); toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600); }
function button(action, label, primary = false, attrs = '') { return `<button type="button" class="button ${primary ? 'button-primary' : ''}" data-action="${action}" ${attrs}>${label}</button>`; }
function field(label, name, value = '', type = 'text', attrs = '') { return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}></div>`; }
function panel(title, body, extra = '') { return `<section class="panel ${extra}"><h2>${title}</h2>${body}</section>`; }
function toolCard(item) { return `<button class="tool-card" data-route="${item[0]}"><span class="tool-arrow">↗</span><span class="tool-icon">${item[1]}</span><h3>${item[2]}</h3><p>${item[3]}</p></button>`; }
function navUpdate() { document.querySelectorAll('[data-route]').forEach(el => el.classList.toggle('active', el.dataset.route === route)); const name = routeNames[route] || '概览'; $('#crumb').textContent = name; $('#pageTitle').textContent = route === 'home' ? '活动工具箱' : name; }
function setRoute(name) { if (!routeNames[name]) name = 'home'; if (route === 'undercover') hideSpyWord(); route = name; location.hash = name === 'home' ? '' : name; render(); $('#main').focus({preventScroll:true}); $('.sidebar').classList.remove('open'); $('.mobile-overlay').classList.remove('show'); }
function render() { navUpdate(); const view = {home:homePage,groups:groupsPage,lottery:lotteryPage,bomb:bombPage,undercover:undercoverPage,draw:drawPage,minigames:minigamesPage,timer:timerPage,scores:scoresPage,poll:pollPage,agenda:agendaPage,settings:settingsPage}[route] || homePage; app.innerHTML = view(); const audio=$('#songAudio');if(audio&&audioUrl)audio.src=audioUrl; bindView(); }

function homePage() {
  const sets = ['班级组织','趣味游戏','现场互动','通用工具'];
  return `<section class="hero"><div class="hero-copy"><div class="hero-kicker">CLASSKIT · READY WHEN YOU ARE</div><h2>把活动的好点子，<br>装进一个小工具箱。</h2><p>分组、小游戏、计时和流程安排。免注册，配置留在本机，换个班级也能继续用。</p></div><button class="button" data-route="agenda">☷　开始安排活动</button></section>${sets.map(category=>`<section><div class="section-heading"><div><h2>${category}</h2><p>${category==='班级组织'?'让活动快速开始。':category==='趣味游戏'?'规则简单，一部手机轮流使用。':category==='现场互动'?'投影展示或主持人现场操作。':'备份配置并按需恢复。'}</p></div><span class="eyebrow">${String(toolCards.filter(x=>x[4]===category).length).padStart(2,'0')} TOOLS</span></div><div class="tool-grid">${toolCards.filter(x=>x[4]===category).map(toolCard).join('')}</div></section>`).join('')}`;
}

function groupsPage() {
  const saved = state('groups', null); const mode = saved?.mode || 'count';
  return `<div class="two-column">${panel('安排分组',`<form id="groupsForm"><div class="field"><label for="participants">姓名名单（每行一位，也可用逗号分隔）</label><textarea id="participants" placeholder="小林\n小周\n小陈">${esc(saved?.source || '')}</textarea></div>${field('匿名人数（名单留空时）','peopleCount',saved?.people||'','number','min="1" max="500" placeholder="输入人数"')}<span class="help">重复姓名会作为独立参与者保留；名单留空时使用通用编号生成参与者。</span><div class="form-grid"><div class="field"><label for="groupMode">分组方式</label><select id="groupMode"><option value="count" ${mode==='count'?'selected':''}>指定组数</option><option value="size" ${mode==='count'?'':'selected'}>指定每组人数</option></select></div>${field('组数或每组人数','groupValue',saved?.value || 4,'number','min="1" max="500"')}</div><div class="inline-actions"><button class="button button-primary" type="submit">随机生成分组</button><button class="button" type="button" data-action="restore-groups">恢复上次结果</button></div></form>`)}${panel('分组结果',saved?.groups?.length?`${groupsMarkup(saved.groups)}<div class="inline-actions">${button('copy-groups','复制结果')}${button('save-groups','保存结果')}</div>`:`<div class="empty-state">填写名单或匿名人数后生成<br>系统会均衡分配，不遗漏参与者。</div>`)}</div>`;
}
function groupsMarkup(groups) { return `<div class="group-grid">${groups.map(group=>`<article class="group-card"><h4>${esc(group.name)} <span class="muted">· ${group.members.length} 人</span></h4><ol>${group.members.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></article>`).join('')}</div>`; }

function lotteryPage() {
  const saved=state('lottery',{source:'',result:[],history:[],allowRepeat:false,amount:1});
  return `<div class="two-column">${panel('候选名单',`<form id="lotteryForm"><div class="field"><label for="lotteryNames">名单（每行一位）</label><textarea id="lotteryNames" placeholder="粘贴参与者姓名或任务名称">${esc(saved.source||'')}</textarea><span class="help">空行会自动忽略。重复名字会保留为两项，便于同名参与者。</span></div><div class="form-grid">${field('抽取数量','lotteryAmount',saved.amount||1,'number','min="1" max="500"')}<label class="switch-row"><input id="allowRepeat" type="checkbox" ${saved.allowRepeat?'checked':''}>允许重复抽取</label></div><div class="inline-actions"><button class="button button-primary" type="submit">现在抽签</button>${button('reset-lottery','清空结果')}</div></form>`)}${panel('抽取结果',saved.result?.length?`<div class="result-word">${saved.result.map(esc).join('　 · 　')}</div><div class="inline-actions">${button('copy-lottery','复制结果')}${button('draw-again','重新抽取',true)}</div>`:`<div class="empty-state">候选人会在这里揭晓</div>`)}<section class="panel"> <h3>本地历史（最近 10 次）</h3>${saved.history?.length?saved.history.map(row=>`<div class="option-row"><span class="tag">${esc(new Date(row.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</span><span>${row.items.map(esc).join('、')}</span></div>`).join(''):'<span class="help">历史只保存在这台设备，可随备份一起导出。</span>'}</section></div>`;
}

function bombPage() {
  const game=state('bomb',{min:1,max:100,low:1,high:100,tries:0,status:'ready'});
  return `<div class="two-column">${panel('数字炸弹',`<form id="bombForm"><div class="form-grid">${field('数字下限','bombMin',game.min,'number')}${field('数字上限','bombMax',game.max,'number')}</div><div class="inline-actions"><button class="button button-primary" type="submit">${game.status==='playing'?'重新开始':'开始新一局'}</button></div></form><div class="notice" id="bombHint">${game.status==='playing'?`猜测范围：${game.low} – ${game.high}`:'设置范围后开始，程序会自动裁判。'}</div>${game.status==='playing'?`<form id="guessForm" class="form-grid">${field('你的猜测','guessValue',game.low,'number',`min="${game.low}" max="${game.high}"`)}<div class="field"><label>&nbsp;</label><button class="button button-primary" type="submit">提交猜测</button></div></form>`:''}${game.status==='won'?`<div class="result-word">猜中了！</div>`:''}<p class="help">已猜 ${game.tries||0} 次。猜错后范围会收窄；刷新页面可继续本局。</p>`)}${panel('玩法说明',`<p class="help">设定上下限后，系统会在范围内随机选一个整数。每次猜测后只显示新范围，不会泄露答案。</p><div class="tag">范围上限：1,000,000</div>`)}</div>`;
}

function undercoverPage() {
  const game=state('undercover',null); const custom=state('undercoverWords',[]);
  if (!game?.players?.length) return `<div class="two-column">${panel('开始一局',`<form id="undercoverForm">${field('玩家人数','playerCount',6,'number','min="3" max="50"')}<div class="form-grid">${field('卧底人数','spyCount',1,'number','min="1"')}<div class="field"><label for="wordPair">词库</label><select id="wordPair"><option value="default">默认词库（${words.undercover.length} 对）</option><option value="custom" ${custom.length?'':'disabled'}>自定义词库（${custom.length} 对）</option></select></div></div><div class="inline-actions"><button class="button button-primary" type="submit">随机分配词条</button>${button('edit-words','管理自定义词库')}</div></form><div class="notice">单设备轮流查看。请把屏幕交给当前玩家；离开页面、切换标签或 12 秒后，词条会自动遮挡。</div>`)}${panel('游戏说明',`<p class="help">默认每局随机抽取一组相似词。支持多个卧底；每个玩家只能看到自己的词，之后进行描述、投票和揭晓。</p>`)}</div>`;
  const current=game.index||0; const isReveal=game.revealed===true; const player=game.players[current];
  return `<div class="two-column"><div>${panel(`第 ${game.round||1} 轮 · 轮到玩家 ${current+1}`,isReveal?`<div class="player-mask"><div class="help">仅玩家 ${player.player} 查看 · 12 秒后自动遮挡</div><div class="player-word">${esc(player.word)}</div><div class="tag">看完请点下方按钮并交给下一位</div></div>`:`<div class="player-mask"><div class="player-word">🔒</div><p class="help">确认只有玩家 ${player.player} 正在看屏幕后，再点揭示词条。</p><button class="button button-primary" data-action="reveal-spy">揭示我的词条</button></div>`)}<div class="inline-actions">${current>0?button('previous-spy','上一个玩家'):''}${button('next-spy',current===game.players.length-1?'进入投票':'遮住并交给下一位',true)}${button('new-undercover','重新开始')}</div><div class="notice">词条不会在页面切换时显示。浏览器截屏、拍照或设备被他人查看无法由静态网页阻止。</div></div>${panel('投票与结果',`<form id="voteForm"><div class="form-grid"><div class="field"><label for="votedPlayer">本轮投给</label><select id="votedPlayer">${game.players.map(p=>`<option value="${p.player}">玩家 ${p.player}</option>`).join('')}</select></div>${field('轮次说明（可选）','voteNote',`第 ${game.round||1} 轮`)}</div><button class="button" type="submit">记录本轮投票</button></form>${game.votes?.length?game.votes.map(v=>`<div class="option-row"><span class="tag">${esc(v.note)}</span>投出玩家 ${v.player}</div>`).join(''):''}<div class="inline-actions">${button('reveal-roles','揭晓身份')}${button('next-round','下一轮投票')}</div>${game.showRoles?`<div class="result-box"><h3>本局词语：${esc(game.pair?.join(' / '))}</h3>${game.players.map(p=>`<div class="option-row">玩家 ${p.player} · ${p.role==='undercover'?'卧底':'平民'} · ${esc(p.word)}</div>`).join('')}</div>`:''}`)}</div>`;
}

function drawPage() {
  const game=state('draw',{difficulty:'all',seconds:60,remaining:60,active:false,shown:false,custom:[]});
  const current=game.current; const prompt=current ? esc(current[0]) : '抽一张开始';
  return `<div class="two-column">${panel('你画我猜',`<div class="form-grid"><div class="field"><label for="drawDifficulty">题目难度</label><select id="drawDifficulty"><option value="all" ${game.difficulty==='all'?'selected':''}>全部</option><option value="easy" ${game.difficulty==='easy'?'selected':''}>轻松入门</option><option value="normal" ${game.difficulty==='normal'?'selected':''}>脑洞挑战</option></select></div>${field('倒计时（秒）','drawSeconds',game.seconds,'number','min="5" max="600"')}</div><div class="result-box"><div class="result-word">${game.shown?prompt:'🙈 题目准备好了？'}</div><div class="timer-face" id="drawTimer">${formatTime(game.remaining??game.seconds)}</div></div><div class="inline-actions">${button('draw-prompt','抽取题目',true)}${button('toggle-draw-answer',game.shown?'遮住题目':'查看题目')}${button('start-draw-timer',game.active?'暂停计时':'开始倒计时')}${button('skip-draw','跳过')}${button('edit-draw-words','管理自定义词库')}</div><p class="help">可以在纸上、黑板或白板作画。本机只提供词题和计时，不包含在线绘画。</p>`)}${panel('规则小贴士',`<p class="help">画画者不能写字、说话或比划字母。猜中后可以加分；每轮结束后抽下一题。</p><div class="tag">预设 ${words.draw.length} 题 · 本地可扩充</div>`)}</div>`;
}

function minigamesPage() {
  const active=state('miniGame','garden'); const game=state('mini:'+active,{});
  const tabs=[['garden','逛三园'],['soup','海龟汤'],['song','猜歌名'],['chain','词语接龙'],['seven','数字 7'],['telephone','传话画画']];
  let body='';
  if(active==='garden') body=`<h2>逛三园</h2><p class="help">从类别开始轮流说词，重复或超时就算挑战失败。</p><div class="result-word">${esc(game.category||'准备好逛哪一园？')}</div><div class="inline-actions">${button('garden-draw','随机抽类别',true)}${button('garden-copy','复制类别')}</div>`;
  if(active==='soup') { const soup=game.soup; body=`<h2>海龟汤</h2>${soup?`<div class="result-box"><span class="tag">${esc(soup.title)}</span><p>${esc(soup.story)}</p></div>${game.showAnswer?`<div class="notice"><strong>答案：</strong>${esc(soup.answer)}</div>`:`<div class="notice">${esc(soup.hint)}</div><p class="help">玩家只能问主持人可用“是 / 否 / 不重要”回答的问题。</p>`}<div class="inline-actions">${button('toggle-soup-answer',game.showAnswer?'隐藏答案':'揭晓答案')}${button('new-soup','换一道汤题')}</div>`:`<div class="empty-state">抽取一道汤题，主持人读题，其他人提问。</div><div class="inline-actions">${button('new-soup','抽一道汤题',true)}</div>`}`; }
  if(active==='song') body=`<h2>猜歌名 · 本地音频</h2><p class="help">选一段本地音频播放，文件不会上传；歌名由主持人揭晓。</p><div class="field"><label for="songFile">选择音频</label><input id="songFile" type="file" accept="audio/*"></div>${game.fileName?`<div class="tag">已选择：${esc(game.fileName)}</div><audio id="songAudio" controls></audio>`:''}<div class="field">${field('歌名（揭晓前可遮住）','songName',game.songName||'')}${game.showAnswer?`<div class="result-word">${esc(game.songName||'请先填写歌名')}</div>`:''}</div><div class="inline-actions">${button('toggle-song-answer',game.showAnswer?'遮住歌名':'揭晓歌名')}${button('clear-song','清除音频')}</div>`;
  if(active==='chain') body=`<h2>词语接龙</h2><p class="help">下一个词语以当前词的最后一个字开头。可选宽松规则，现场约定多音字和儿化音。</p><div class="result-word">${esc(game.word||'抽取起始词')}</div><div class="timer-face" id="chainTimer">${formatTime(game.remaining||30)}</div><div class="inline-actions">${button('chain-draw','随机初始词',true)}${button('chain-timer',game.active?'暂停计时':'开始 30 秒')}${button('chain-reset','重置计时')}</div>`;
  if(active==='seven') body=`<h2>数字 7 挑战</h2><div class="big-number">${esc(game.start||'？')}</div><div class="notice">${config.sevenRules.map(esc).join('<br>')}</div><div class="inline-actions">${button('seven-draw','随机起始数字',true)}${button('seven-copy','复制规则')}</div>`;
  if(active==='telephone') body=`<h2>传话画画</h2><p class="help">看一句话，交给下一位画出来；再把画交给下一个人猜。</p><div class="result-word">${esc(game.prompt||'抽取一句开场')}</div><div class="inline-actions">${button('telephone-draw','抽一句开场',true)}${button('telephone-copy','复制句子')}</div><span class="tag">保留原网站的 48 条预设句子</span>`;
  return `<div class="panel"><div class="tabs">${tabs.map(([id,label])=>`<button class="tab ${id===active?'active':''}" data-action="mini-tab" data-value="${id}">${label}</button>`).join('')}</div>${body}</div><div class="notice">所有小玩法都在本机独立运行；猜歌使用主持人选择的本地音频，不请求音乐服务。</div>`;
}

function timerPage() {
  const timer=state('timer',{mode:'down',minutes:1,seconds:0,remaining:60,active:false});
  return `<div class="two-column">${panel('通用现场计时器',`<div class="form-grid"><div class="field"><label for="timerMode">计时方式</label><select id="timerMode"><option value="down" ${timer.mode==='down'?'selected':''}>倒计时</option><option value="up" ${timer.mode==='up'?'selected':''}>正计时</option></select></div><div class="form-grid">${field('分','timerMinutes',timer.minutes??1,'number','min="0" max="999"')}${field('秒','timerSeconds',timer.seconds??0,'number','min="0" max="59"')}</div></div><div class="result-box"><div class="timer-face" id="timerFace">${formatTime(timer.remaining??60)}</div></div><div class="timer-controls">${button('timer-toggle',timer.active?'暂停':'开始',true)}${button('timer-reset','重置')}${button('timer-fullscreen','全屏展示')}</div>`)}${panel('用于任何环节',`<p class="help">计时状态每秒保存。刷新页面后可恢复当前计时；浏览器暂停后台标签时会按真实经过时间校正。</p>`)}</div>`;
}
function settingsPage() { return `<div class="two-column">${panel('数据备份',`<p class="help">活动、题库、投票、抽签历史和积分都保存在当前浏览器。定期导出 JSON，可在另一台设备导入。</p><div class="inline-actions">${button('export-backup','导出全部数据',true)}<button class="button" id="settingsImport">导入 JSON 备份或活动</button></div><p class="help">导入完整备份会替换本机 ClassKit 数据；导入单个活动文件会将其加入活动模板。</p>`)}${panel('外观与恢复',`<p class="help">当前数据格式 v1；各工具分开保存。无法识别的数据不会自动覆盖。</p><div class="inline-actions">${button('theme-toggle','切换浅色 / 深色')}${button('reset-local-data','恢复默认并清空本地数据')}</div><div class="notice">清空前建议先导出备份；确认后仅移除此浏览器中 ClassKit 的数据。</div>`)}${panel('本地运行与部署',`<p class="help">不需要账号、数据库、第三方 API 或构建步骤。通过本地静态服务器运行，也可部署至 GitHub Pages。</p><span class="tag">npm test</span> <span class="tag">python -m http.server 8000</span>`)}</div>`; }
function formatTime(seconds) { const safe=Math.max(0,Math.floor(Number(seconds)||0)); return `${String(Math.floor(safe/60)).padStart(2,'0')}:${String(safe%60).padStart(2,'0')}`; }

function scoresPage() {
  const teams=state('scores',[]);
  return `<div class="two-column">${panel('积分板',`<form id="scoreForm" class="form-grid">${field('队伍或名称','teamName','','text','maxlength="40"')}${field('初始积分','teamScore',0,'number')}<button class="button button-primary" type="submit">添加队伍</button></form><div class="inline-actions">${button('clear-scores','清空积分')}</div>`)}${panel(`当前排名 · ${teams.length} 组`,teams.length?`<div id="scoreRows">${[...teams].sort((a,b)=>b.score-a.score).map(team=>`<div class="score-row"><span class="tag">#${[...teams].sort((a,b)=>b.score-a.score).indexOf(team)+1}</span><span>${esc(team.name)}</span><strong>${team.score}</strong><div class="score-controls"><button data-action="score-change" data-id="${esc(team.id)}" data-delta="-1" aria-label="${esc(team.name)}减一分">−</button><button data-action="score-change" data-id="${esc(team.id)}" data-delta="1" aria-label="${esc(team.name)}加一分">+</button></div></div>`).join('')}</div>`:`<div class="empty-state">添加队伍后开始记分，数据自动保存在本地。</div>`)}</div>`;
}

function pollPage() {
  const poll=state('poll',{title:'现场投票',options:[]}); const total=poll.options.reduce((n,x)=>n+x.votes,0);
  return `<div class="two-column">${panel('投票设置',`<form id="pollForm">${field('投票主题','pollTitle',poll.title||'')}<div class="field"><label for="pollOptions">选项（每行一个）</label><textarea id="pollOptions" placeholder="方案 A\n方案 B">${esc(poll.options.map(x=>x.name).join('\n'))}</textarea></div><div class="inline-actions"><button class="button button-primary" type="submit">保存选项</button>${button('reset-poll','票数清零')}</div></form><div class="notice">单设备本地逐票录入；不支持或模拟跨设备实时投票。</div>`)}${panel('现场统计',poll.options.length?`<h3>${esc(poll.title)} · ${total} 票</h3>${poll.options.map(option=>{const percent=total?Math.round(option.votes/total*100):0;return `<div class="chart-row"><span>${esc(option.name)}</span><div class="progress"><span style="width:${percent}%"></span></div><span>${option.votes}</span><button class="small-button" data-action="vote" data-id="${esc(option.id)}">+1</button></div>`}).join('')}<p class="help">百分比按当前总票数计算。结果可随本机备份导出。</p>`:`<div class="empty-state">先设置投票主题和选项。</div>`)}</div>`;
}

function agendaPage() {
  const agenda=state('agenda',null)||{title:'',items:[],index:0};
  const templates=state('templates',config.templates);
  const item=agenda.items[agenda.index]||null;
  return `<div class="two-column"><div>${panel('活动信息',`<form id="agendaTitleForm">${field('活动名称','agendaTitle',agenda.title||'')}<button class="button button-primary" type="submit">保存名称</button></form><div class="field"><label for="templateSelect">载入或编辑模板</label><select id="templateSelect"><option value="">选择一个可编辑模板</option>${templates.map(t=>`<option value="${esc(t.id)}" ${agenda.templateId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div class="inline-actions">${button('save-template',agenda.templateId?'保存模板修改':'保存为模板')}${button('export-agenda','导出此活动')}${button('delete-agenda','删除当前活动')}</div>`)}${panel('添加环节',`<form id="agendaItemForm" class="form-grid">${field('环节名称','agendaItemTitle','','text','maxlength="80"')}${field('预计分钟','agendaMinutes',5,'number','min="1" max="600"')}<div class="field"><label for="agendaTool">关联工具</label><select id="agendaTool">${[['timer','现场计时器'],['groups','随机分组'],['lottery','随机抽签'],['undercover','谁是卧底'],['draw','你画我猜'],['minigames','小游戏'],['scores','积分板'],['poll','简易投票']].map(([id,n])=>`<option value="${id}">${n}</option>`).join('')}</select></div><button class="button button-primary" type="submit">添加环节</button></form>`)}${panel('活动模板',templates.map(t=>`<div class="agenda-row"><span>${esc(t.name)}</span><span class="muted">${t.items.length} 个环节</span><button class="small-button" data-action="duplicate-template" data-id="${esc(t.id)}">复制</button><button class="small-button" data-action="delete-template" data-id="${esc(t.id)}">删除</button></div>`).join(''))}${agenda.items.length?panel('环节列表',`<div>${agenda.items.map((x,i)=>`<div class="agenda-row"><span class="tag">${i+1}</span><span>${esc(x.title)} · ${x.minutes} 分钟</span><span class="muted">${esc(routeNames[x.tool]||x.tool)}</span><button class="small-button" data-action="agenda-remove" data-index="${i}">删除</button></div>`).join('')}</div>`):''}</div><div>${panel('主持模式',item?`<div class="eyebrow">第 ${agenda.index+1} / ${agenda.items.length} 项</div><div class="result-word">${esc(item.title)}</div><div class="timer-face">${item.minutes} 分</div><div class="tag">关联工具：${esc(routeNames[item.tool]||item.tool)}</div><div class="inline-actions">${button('agenda-prev','上一项')}${button('agenda-next','下一项',true)}<button class="button" data-route="${esc(item.tool)}">打开关联工具 ↗</button>${button('agenda-fullscreen','全屏主持')}</div>`:`<div class="empty-state">添加环节或载入模板后开始主持。</div>`)}</div></div>`;
}

function bindView() { /* click and submit are delegated once on the app root */ }

function hideSpyWord() { clearTimeout(spyHideTimer); const game=state('undercover',null); if (game?.revealed) { save('undercover',{...game,revealed:false}); if(route==='undercover')render(); } }
function revealSpyWord() { const game=state('undercover',null); if (!game?.players?.length) return; save('undercover',{...game,revealed:true}); spyHideTimer=setTimeout(hideSpyWord,12000); render(); }

function exportBackup() {
  const payload={format:'classkit-backup',version:1,exportedAt:new Date().toISOString(),...listState()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`classkit-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url); notify('备份文件已导出。');
}
function importBackup(file) {
  if(file.size>2*1024*1024){notify('文件过大，请使用 2 MB 以内的 JSON 备份。',true);return}
  const reader=new FileReader(); reader.onload=()=>{try{const data=JSON.parse(String(reader.result));if(data.format==='classkit-activity'&&data.version===1&&Array.isArray(data.items)&&data.items.length<=100){const templates=state('templates',config.templates);templates.push({id:`custom-${Date.now()}`,name:String(data.title||'导入的活动').slice(0,80),description:'从活动 JSON 导入',items:data.items.map(item=>({title:String(item.title||'环节').slice(0,80),minutes:Math.max(1,Math.min(600,Number(item.minutes)||5)),tool:routeNames[item.tool]?item.tool:'timer'}))});save('templates',templates);notify('活动已作为模板导入。');if(route==='agenda')render();return}if(data.format!=='classkit-backup'||!Number.isInteger(data.version)||data.version>1)throw new Error('文件格式或备份版本不受支持。');replaceAllState(data);notify('备份已导入，页面正在刷新。');setTimeout(()=>location.reload(),450)}catch(error){notify(`导入失败：${error.message}`,true)}};reader.onerror=()=>notify('无法读取文件。',true);reader.readAsText(file);
}

function showModal(title, body, onSave) { lastFocus=document.activeElement; $('#modalTitle').textContent=title; $('#modalBody').innerHTML=body; $('#modal').hidden=false; const first=$('#modalBody textarea'); first?.focus(); $('#modalBody [data-modal-save]')?.addEventListener('click',()=>{onSave?.();closeModal()}); }
function closeModal() { $('#modal').hidden=true; lastFocus?.focus?.(); }
function editWords(key, title, existing, placeholder, callback) { showModal(title,`<div class="field"><label for="customWords">每行一条</label><textarea id="customWords" placeholder="${esc(placeholder)}">${esc(existing.join('\n'))}</textarea></div><div class="inline-actions"><button class="button button-primary" data-modal-save>保存词库</button><span class="help">支持直接粘贴多行文本。</span></div>`,()=>callback($('#customWords').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))); }

app.addEventListener('click', async event => {
  const routeButton=event.target.closest('[data-route]'); if(routeButton){setRoute(routeButton.dataset.route);return;}
  const buttonEl=event.target.closest('[data-action]'); if(!buttonEl)return;
  const action=buttonEl.dataset.action; const val=buttonEl.dataset.value;
  if(action==='copy-groups'){const saved=state('groups',null); await copyText(exportGroups(saved?.groups||[]));}
  else if(action==='save-groups'){notify('分组结果已保存在本地。');}
  else if(action==='restore-groups'){render();notify('已恢复上次的分组设置和结果。');}
  else if(action==='reset-lottery'){save('lottery',{source:'',result:[],history:[],allowRepeat:false,amount:1});render();}
  else if(action==='draw-again'){drawFromLottery();}
  else if(action==='copy-lottery'){const s=state('lottery',{});await copyText((s.result||[]).join('\n'));}
  else if(action==='start-bomb'){startBomb();}
  else if(action==='new-undercover'){if(confirm('重新开始会覆盖当前本局记录。继续吗？')){save('undercover',null);render();}}
  else if(action==='reveal-spy'){revealSpyWord();}
  else if(action==='next-spy'){advanceSpy(1);}
  else if(action==='previous-spy'){advanceSpy(-1);}
  else if(action==='reveal-roles'){const s=state('undercover',{});save('undercover',{...s,showRoles:!s.showRoles,revealed:false});render();}
  else if(action==='next-round'){const s=state('undercover',{});save('undercover',{...s,round:(s.round||1)+1,index:0,revealed:false,showRoles:false});render();}
  else if(action==='edit-words'){const x=state('undercoverWords',[]);editWords('undercoverWords','编辑卧底词库',x.map(a=>a.join(' / ')),'可乐 / 雪碧',rows=>{const pairs=rows.map(row=>row.split(/[\/，,|]/).map(x=>x.trim()).filter(Boolean)).filter(x=>x.length>=2).map(x=>x.slice(0,2));save('undercoverWords',pairs);notify(`已保存 ${pairs.length} 组词语。`);render()});}
  else if(action==='draw-prompt'){drawPrompt();}
  else if(action==='toggle-draw-answer'){const s=state('draw',{});save('draw',{...s,shown:!s.shown});render();}
  else if(action==='start-draw-timer'){toggleDrawTimer();}
  else if(action==='skip-draw'){drawPrompt();}
  else if(action==='edit-draw-words'){const s=state('draw',{custom:[]});editWords('draw','编辑你画我猜词库',s.custom||[],'例如：外星人逛超市',rows=>{save('draw',{...state('draw',{}),custom:rows});notify(`已保存 ${rows.length} 个自定义题目。`);render()});}
  else if(action==='mini-tab'){hideSpyWord();save('miniGame',val);render();}
  else if(action==='garden-draw'){const s=state('mini:garden',{});const category=drawItems(config.gardens,1)[0];save('mini:garden',{...s,category});render();}
  else if(action==='garden-copy'){const s=state('mini:garden',{});await copyText(s.category||'');}
  else if(action==='new-soup'){const soup=drawItems(config.turtleSoups,1)[0];save('mini:soup',{soup,showAnswer:false});render();}
  else if(action==='toggle-soup-answer'){const s=state('mini:soup',{});save('mini:soup',{...s,showAnswer:!s.showAnswer});render();}
  else if(action==='toggle-song-answer'){const s=state('mini:song',{});save('mini:song',{...s,showAnswer:!s.showAnswer});render();}
  else if(action==='clear-song'){if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=null;save('mini:song',{showAnswer:false});render();}
  else if(action==='chain-draw'){const s=state('mini:chain',{});save('mini:chain',{...s,word:drawItems(config.chainWords,1)[0],remaining:30,active:false,lastAt:0});render();}
  else if(action==='chain-timer'){toggleMiniTimer();}
  else if(action==='chain-reset'){save('mini:chain',{...state('mini:chain',{}),remaining:30,active:false,lastAt:0});render();}
  else if(action==='seven-draw'){const s=state('mini:seven',{});save('mini:seven',{...s,start:randomInt(1,30)});render();}
  else if(action==='seven-copy'){await copyText(config.sevenRules.join('\n'));}
  else if(action==='telephone-draw'){const item=drawItems(words.telephone,1)[0];save('mini:telephone',{prompt:item[0]});render();}
  else if(action==='telephone-copy'){await copyText(state('mini:telephone',{}).prompt||'');}
  else if(action==='timer-toggle'){toggleTimer();}
  else if(action==='timer-reset'){const t=timerSettings();save('timer',{...t.old,mode:t.mode,minutes:t.minutes,seconds:t.seconds,remaining:t.remaining,active:false,lastAt:0});render();}
  else if(action==='timer-fullscreen'){document.body.classList.add('display-only');app.classList.add('full-screen-mode');fullscreen();}
  else if(action==='score-change'){const teams=state('scores',[]);const t=teams.find(x=>x.id===buttonEl.dataset.id);if(t){t.score+=Number(buttonEl.dataset.delta);save('scores',teams);render();}}
  else if(action==='clear-scores'){if(confirm('清空所有队伍和积分？')){save('scores',[]);render();}}
  else if(action==='vote'){const poll=state('poll',{});const option=poll.options.find(x=>x.id===buttonEl.dataset.id);if(option){option.votes+=1;save('poll',poll);render();}}
  else if(action==='reset-poll'){const poll=state('poll',{});poll.options=(poll.options||[]).map(x=>({...x,votes:0}));save('poll',poll);render();}
  else if(action==='agenda-remove'){const agenda=state('agenda',{});agenda.items.splice(Number(buttonEl.dataset.index),1);agenda.index=Math.min(agenda.index,Math.max(agenda.items.length-1,0));save('agenda',agenda);render();}
  else if(action==='agenda-next'||action==='agenda-prev'){const agenda=state('agenda',{});agenda.index=Math.max(0,Math.min(agenda.items.length-1,(agenda.index||0)+(action==='agenda-next'?1:-1)));save('agenda',agenda);render();}
  else if(action==='agenda-fullscreen'){document.body.classList.add('display-only');app.classList.add('full-screen-mode');fullscreen();}
  else if(action==='save-template'){saveTemplate();}
  else if(action==='duplicate-template'){const templates=state('templates',config.templates);const original=templates.find(t=>t.id===buttonEl.dataset.id);if(original){templates.push({...structuredClone(original),id:`custom-${Date.now()}`,name:`${original.name}（副本）`});save('templates',templates);render();notify('已复制模板。')}}
  else if(action==='delete-template'){const templates=state('templates',config.templates).filter(t=>t.id!==buttonEl.dataset.id);save('templates',templates);render();notify('已删除自定义模板。')}
  else if(action==='reset-local-data'){if(confirm('这会删除此浏览器中 ClassKit 保存的设置、题库、活动和历史。建议先导出备份。确认恢复默认？')){replaceAllState({});notify('已清除本地数据，页面即将重载。');setTimeout(()=>location.reload(),450)}}
  else if(action==='export-agenda'){const agenda=state('agenda',{});downloadJson({format:'classkit-activity',version:1,...agenda},'classkit-activity.json');}
  else if(action==='delete-agenda'){if(confirm('删除当前活动流程？此操作不会影响已保存的其他模板。')){save('agenda',{title:'',items:[],index:0});render();}}
  else if(action==='theme-toggle'){toggleTheme();}
  else if(action==='export-backup'){exportBackup();}
});

document.addEventListener('click',event=>{const routeButton=event.target.closest('[data-route]');if(routeButton&&!app.contains(routeButton)){setRoute(routeButton.dataset.route);return}const el=event.target.closest('[data-action="theme-toggle"]');if(el)toggleTheme();if(event.target.matches('[data-close-modal]')||event.target.id==='modal')closeModal();});
document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;
  if(form.id==='groupsForm'){try{const source=$('#participants').value;const people=$('#peopleCount').value;const participants=parseParticipants(source,people);const mode=$('#groupMode').value;const n=Number($('#groupValue').value);const groups=makeGroups(participants,mode==='count'?{groupCount:n}:{groupSize:n});save('groups',{source,people,value:n,mode,groups,updatedAt:Date.now()});render();}catch(error){notify(error.message,true)}}
  if(form.id==='lotteryForm'){save('lottery',{...state('lottery',{}),source:$('#lotteryNames').value,amount:$('#lotteryAmount').value,allowRepeat:$('#allowRepeat').checked,result:[]});drawFromLottery();}
  if(form.id==='bombForm'){const min=Number($('#bombMin').value),max=Number($('#bombMax').value);try{const target=randomInt(min,max);save('bomb',{min,max,low:min,high:max,target,tries:0,status:'playing'});render();}catch(error){notify(error.message,true)}}
  if(form.id==='guessForm'){const s=state('bomb',{});const result=compareGuess($('#guessValue').value,s.target,s.low,s.high);if(result.status==='invalid'){notify(`请输入 ${s.low} 至 ${s.high} 之间的整数。`,true);return}if(result.status==='correct'){save('bomb',{...s,tries:s.tries+1,status:'won'});render();return}save('bomb',{...s,low:result.min,high:result.max,tries:s.tries+1});render();notify(result.status==='low'?'偏小，范围已收窄。':'偏大，范围已收窄。')}
  if(form.id==='undercoverForm'){try{const count=Number($('#playerCount').value);const pairs=$('#wordPair').value==='custom'?state('undercoverWords',[]):words.undercover;const pair=drawItems(pairs,1)[0];const players=assignUndercover(count,pair,Number($('#spyCount').value));save('undercover',{players,pair,index:0,round:1,votes:[],revealed:false,showRoles:false});render();}catch(error){notify(error.message,true)}}
  if(form.id==='voteForm'){const s=state('undercover',{});s.votes=[...(s.votes||[]),{player:Number($('#votedPlayer').value),note:$('#voteNote').value||`第 ${s.round||1} 轮`}];save('undercover',s);render();notify('已记录本轮投票。')}
  if(form.id==='drawWordsForm'){const s=state('draw',{});save('draw',{...s,custom:$('#customDrawWords').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)});render();}
  if(form.id==='scoreForm'){const name=$('#teamName').value.trim();if(!name){notify('请填写队伍或名称。',true);return}const teams=state('scores',[]);if(teams.some(x=>x.name===name)){notify('这个名称已存在，请换一个名称。',true);return}teams.push({id:crypto.randomUUID?.()||String(Date.now()),name,score:Number($('#teamScore').value)||0});save('scores',teams);render();}
  if(form.id==='pollForm'){const title=$('#pollTitle').value.trim()||'现场投票';const old=state('poll',{options:[]});const names=[...new Set($('#pollOptions').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];if(!names.length){notify('至少添加一个投票选项。',true);return}const options=names.map(name=>old.options.find(x=>x.name===name)||{id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,name,votes:0});save('poll',{title,options});render();}
  if(form.id==='agendaTitleForm'){const agenda=state('agenda',{items:[],index:0});agenda.title=$('#agendaTitle').value.trim();save('agenda',agenda);render();notify('活动名称已保存。')}
  if(form.id==='agendaItemForm'){const agenda=state('agenda',{title:'',items:[],index:0});const title=$('#agendaItemTitle').value.trim();const minutes=Number($('#agendaMinutes').value);if(!title||!Number.isInteger(minutes)||minutes<1||minutes>600){notify('请填写环节名称和 1–600 分钟时长。',true);return}agenda.items.push({title,minutes,tool:$('#agendaTool').value});if(agenda.items.length===1)agenda.index=0;save('agenda',agenda);render();}
});

function drawFromLottery(){const s=state('lottery',{});try{const participants=parseParticipants(s.source,0);const result=drawItems(participants,s.amount,{allowRepeat:s.allowRepeat});s.result=result;s.history=[{at:new Date().toISOString(),items:result},...(s.history||[])].slice(0,10);save('lottery',s);render();}catch(error){notify(error.message,true)}}
function startBomb(){const form=$('#bombForm');form?.requestSubmit();}
function advanceSpy(delta){const s=state('undercover',null);if(!s)return;if(delta>0&&s.index===s.players.length-1){save('undercover',{...s,revealed:false});route='undercover';render();notify('所有玩家已查看词条，可以开始描述和投票。');return}save('undercover',{...s,index:Math.max(0,Math.min(s.players.length-1,s.index+delta)),revealed:false});render();}
function drawPrompt(){const s=state('draw',{difficulty:'all',custom:[]});let pool=[...words.draw,...(s.custom||[]).map(x=>[x,'normal'])];const difficulty=$('#drawDifficulty')?.value||s.difficulty||'all';if(difficulty!=='all')pool=pool.filter(x=>x[1]===difficulty);try{const item=drawItems(pool,1)[0];const seconds=Math.max(5,Math.min(600,Number($('#drawSeconds')?.value||s.seconds||60)));save('draw',{...s,difficulty,seconds,remaining:seconds,current:item,shown:true,active:false,lastAt:0});render();}catch(error){notify(error.message,true)}}
function toggleDrawTimer(){const s=state('draw',{});if(!s.current){notify('先抽取一张题目。',true);return}const active=!s.active;save('draw',{...s,active,shown:true,lastAt:active?Date.now():0});render()}
function toggleMiniTimer(){const s=state('mini:chain',{});save('mini:chain',{...s,active:!s.active,lastAt:!s.active?Date.now():0});render()}
function timerSettings(){const old=state('timer',{mode:'down',minutes:1,seconds:0,remaining:60});const mode=$('#timerMode')?.value||old.mode;const minutes=Math.max(0,Math.min(999,Number($('#timerMinutes')?.value??old.minutes)||0));const seconds=Math.max(0,Math.min(59,Number($('#timerSeconds')?.value??old.seconds)||0));return {old,mode,minutes,seconds,remaining:mode==='up'?0:minutes*60+seconds}}
function toggleTimer(){const {old,mode,minutes,seconds,remaining}=timerSettings();if(old.active){save('timer',{...old,active:false,lastAt:0});render();return}const changed=mode!==old.mode||minutes!==old.minutes||seconds!==old.seconds;const initial=changed?remaining:old.remaining;if(mode==='down'&&initial<=0){notify('倒计时结束，请重置后再开始。');return}save('timer',{...old,mode,minutes,seconds,remaining:initial,active:true,lastAt:Date.now()});render()}
function timerTick(){const now=Date.now();for(const [key,show] of [['timer',route==='timer'],['draw',route==='draw'],['mini:chain',route==='minigames'&&state('miniGame','')==='chain']]){const s=state(key,null);if(!s?.active)continue;const elapsed=Math.max(0,Math.floor((now-(s.lastAt||now))/1000));if(!elapsed)continue;let remaining=(s.remaining??s.seconds??60)+(key==='timer'&&s.mode==='up'?elapsed:-elapsed);let active=s.active;if(key==='timer'&&s.mode==='up')remaining=(s.remaining||0)+elapsed;if(key==='draw'&&remaining<=0){remaining=0;active=false;notify('时间到！')};if(key==='mini:chain'&&remaining<=0){remaining=0;active=false;notify('接龙时间到！')};save(key,{...s,remaining,active,lastAt:active?now:0});if(show){const el=$('#timerFace')||$('#drawTimer')||$('#chainTimer');if(el)el.textContent=formatTime(remaining)}}}
function fullscreen(){try{document.documentElement.requestFullscreen?.()}catch{}}
function exitDisplay(){if(!document.body.classList.contains('display-only'))return;document.body.classList.remove('display-only');app.classList.remove('full-screen-mode');if(document.fullscreenElement)document.exitFullscreen?.()}
function toggleTheme(){const dark=!document.documentElement.classList.contains('dark');document.documentElement.classList.toggle('dark',dark);save('preferences',{...state('preferences',{}),theme:dark?'dark':'light'});}
function copyText(text){if(!text){notify('没有可复制的内容。');return}const write=navigator.clipboard?.writeText(text);if(write)write.then(()=>notify('已复制到剪贴板。')).catch(()=>fallbackCopy(text));else fallbackCopy(text)}
function fallbackCopy(text){const input=document.createElement('textarea');input.value=text;document.body.append(input);input.select();try{document.execCommand('copy');notify('已复制到剪贴板。')}catch{notify('复制失败，请手动选择内容。',true)}input.remove()}
function downloadJson(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function saveTemplate(){const agenda=state('agenda',{});if(!agenda.items?.length){notify('先添加几个环节再保存模板。',true);return}const templates=state('templates',config.templates);const existing=templates.findIndex(t=>t.id===agenda.templateId);if(existing>=0){templates[existing]={...templates[existing],name:agenda.title||'我的活动模板',items:agenda.items};save('templates',templates);notify('模板修改已保存。')}else{const id=`custom-${Date.now()}`;templates.push({id,name:agenda.title||'我的活动模板',description:'本地保存的活动流程',items:agenda.items});agenda.templateId=id;save('agenda',agenda);save('templates',templates);notify('已保存为模板。')}}

$('#app').addEventListener('change',event=>{
  if(event.target.id==='templateSelect'&&event.target.value){const template=(state('templates',config.templates)).find(t=>t.id===event.target.value)||config.templates.find(t=>t.id===event.target.value);if(template){save('agenda',{title:template.name,templateId:template.id,items:structuredClone(template.items),index:0});render();notify('活动模板已载入，可继续修改。')}}
  if(event.target.id==='drawDifficulty'||event.target.id==='drawSeconds'){const s=state('draw',{});save('draw',{...s,difficulty:$('#drawDifficulty').value,seconds:Number($('#drawSeconds').value)||60})}
  if(event.target.id==='timerMode'||event.target.id==='timerMinutes'||event.target.id==='timerSeconds'){const mode=$('#timerMode').value;const minutes=Math.max(0,Number($('#timerMinutes').value)||0);const seconds=Math.max(0,Math.min(59,Number($('#timerSeconds').value)||0));save('timer',{mode,minutes,seconds,remaining:mode==='up'?0:minutes*60+seconds,active:false,lastAt:0});render()}
  if(event.target.id==='songFile'){const file=event.target.files?.[0];if(file){if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(file);const s=state('mini:song',{});save('mini:song',{...s,fileName:file.name});render();const audio=$('#songAudio');if(audio)audio.src=audioUrl;}}
});
$('#app').addEventListener('input',event=>{if(['timerMinutes','timerSeconds'].includes(event.target.id)){const t=timerSettings();save('timer',{...t.old,mode:t.mode,minutes:t.minutes,seconds:t.seconds,remaining:t.remaining,active:false,lastAt:0});const face=$('#timerFace');if(face)face.textContent=formatTime(t.remaining)}});
$('#importButton').addEventListener('click',()=>$('#importFile').click());$('#importFile').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importBackup(file);event.target.value=''});document.addEventListener('click',event=>{if(event.target.id==='settingsImport')$('#importFile').click()});
$('#exportButton').addEventListener('click',exportBackup);
$('#themeToggle')?.addEventListener('click',toggleTheme);$('#themeToggleDesktop')?.addEventListener('click',toggleTheme);
$('#menuToggle')?.addEventListener('click',()=>{$('.sidebar').classList.toggle('open');$('.mobile-overlay').classList.toggle('show')});
if(!$('.mobile-overlay')){const overlay=document.createElement('div');overlay.className='mobile-overlay';overlay.addEventListener('click',()=>{$('.sidebar').classList.remove('open');overlay.classList.remove('show')});document.body.append(overlay)}
window.addEventListener('hashchange',()=>{const wanted=location.hash.slice(1)||'home';if(routeNames[wanted]){if(route==='undercover'&&wanted!=='undercover')hideSpyWord();route=wanted;render()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideSpyWord()});window.addEventListener('pagehide',hideSpyWord);window.addEventListener('pageshow',()=>{if(route==='undercover')hideSpyWord()});window.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal();exitDisplay();$('.sidebar').classList.remove('open');$('.mobile-overlay').classList.remove('show')}});document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)exitDisplay()});
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname}).catch(()=>{});
const pref=state('preferences',{});if(pref.theme==='dark'||(pref.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');
if(!routeNames[location.hash.slice(1)])history.replaceState(null,'',location.pathname+location.search+'#home');else route=location.hash.slice(1);if(route==='undercover')hideSpyWord();
render();
if(ticking)clearInterval(ticking);ticking=setInterval(timerTick,500);
