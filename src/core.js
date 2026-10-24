export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function parseParticipants(text, count = 0) {
  const names = String(text ?? '').split(/\r?\n|[,，;；\t]/).map(value => value.trim()).filter(Boolean);
  if (names.length) return names;
  const amount = Number(count);
  if (!Number.isInteger(amount) || amount < 1 || amount > 500) throw new RangeError('请输入 1–500 人，或填写姓名名单。');
  return Array.from({ length: amount }, (_, i) => `参与者 ${i + 1}`);
}

export function makeGroups(participants, { groupCount, groupSize, random = Math.random }) {
  if (!Array.isArray(participants) || !participants.length) throw new RangeError('名单不能为空。');
  const count = Number(groupCount);
  const size = Number(groupSize);
  if ((!Number.isInteger(count) || count < 1) && (!Number.isInteger(size) || size < 1)) throw new RangeError('请输入有效组数或每组人数。');
  const groupsCount = Number.isInteger(count) && count > 0 ? Math.min(count, participants.length) : Math.ceil(participants.length / size);
  const groups = Array.from({ length: groupsCount }, (_, i) => ({ name: `第 ${i + 1} 组`, members: [] }));
  shuffle(participants, random).forEach((person, index) => groups[index % groupsCount].members.push(person));
  return groups;
}

export function drawItems(items, amount = 1, { allowRepeat = false, exclude = [], random = Math.random } = {}) {
  if (!Array.isArray(items) || !items.length) throw new RangeError('名单不能为空。');
  const wanted = Math.max(1, Math.floor(Number(amount) || 1));
  const available = items.filter(item => !exclude.includes(item));
  if (!available.length) throw new RangeError('沒有可抽取的候选项。');
  if (!allowRepeat && wanted > available.length) throw new RangeError(`不重复抽取最多可抽 ${available.length} 人。`);
  const result = [];
  while (result.length < wanted) {
    const pool = allowRepeat ? items : available.filter(item => !result.includes(item));
    result.push(pool[Math.floor(random() * pool.length)]);
  }
  return result;
}

export function randomInt(min, max, random = Math.random) {
  const lower = Number(min); const upper = Number(max);
  if (!Number.isInteger(lower) || !Number.isInteger(upper) || lower > upper || upper - lower > 1000000) throw new RangeError('请输入合理的整数范围，且上限不能小于下限。');
  return Math.floor(random() * (upper - lower + 1)) + lower;
}

export function compareGuess(guess, target, min, max) {
  const value = Number(guess);
  if (!Number.isInteger(value) || value < min || value > max) return { status: 'invalid', min, max };
  if (value === target) return { status: 'correct', min, max };
  return value < target ? { status: 'low', min: value + 1, max } : { status: 'high', min, max: value - 1 };
}

export function assignUndercover(players, pair, undercoverCount = 1, random = Math.random) {
  const count = Number(players); const spies = Number(undercoverCount);
  if (!Number.isInteger(count) || count < 3 || count > 50) throw new RangeError('玩家人数需为 3–50 人。');
  if (!Array.isArray(pair) || pair.length < 2) throw new RangeError('卧底词库需要至少一组词语。');
  if (!Number.isInteger(spies) || spies < 1 || spies >= count) throw new RangeError('卧底人数需至少 1 人，且少于玩家人数。');
  const order = shuffle(Array.from({ length: count }, (_, i) => i), random);
  const spySet = new Set(order.slice(0, spies));
  return Array.from({ length: count }, (_, i) => ({ player: i + 1, role: spySet.has(i) ? 'undercover' : 'civilian', word: pair[spySet.has(i) ? 1 : 0] }));
}

export function exportGroups(groups) {
  return groups.map(group => `${group.name}\n${group.members.map((name, i) => `  ${i + 1}. ${name}`).join('\n')}`).join('\n\n');
}
