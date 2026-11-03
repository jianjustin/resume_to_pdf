import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEntryHeading } from '../src/entry.js';

const entries = [
  ['青禾生鲜 ｜ 高级数据分析师（2022.03 – 至今）', '青禾生鲜', '高级数据分析师', '2022.03 – 至今'],
  ['木棉出行 ｜ 数据分析师（2019/07 - 2022/02）', '木棉出行', '数据分析师', '2019.07 – 2022.02'],
  ['云溪大学 ｜ 统计学 · 本科（2015.09—2019.06）', '云溪大学', '统计学 · 本科', '2015.09 – 2019.06'],
  ['云笺软件（2022.12 ～ 2023.09）', '云笺软件', '', '2022.12 – 2023.09'],
  ['北辰云服务 （ 2020.08 ~ 2022.12 ）', '北辰云服务', '', '2020.08 – 2022.12'],
  ['门店选址评分模型 | 2023.06 – 2023.11', '门店选址评分模型', '', '2023.06 – 2023.11'],
  ['Acme Inc. | Senior Engineer (2021-03 to present)', 'Acme Inc.', 'Senior Engineer', '2021.03 – Present'],
  ['Startup (2024 – Now)', 'Startup', '', '2024 – Present'],
  ['实习（2023.7 - 今）', '实习', '', '2023.07 – 至今'],
  ['某公司（2020年8月 至 2022年12月）', '某公司', '', '2020.08 – 2022.12'],
  ['某大学（2021.6）', '某大学', '', '2021.06'],
  ['A | B | C (2017 - 2021)', 'A', 'B · C', '2017 – 2021'],
  ['[Acme](https://acme.test) | Engineer (2021 - 2022)', '[Acme](https://acme.test)', 'Engineer', '2021 – 2022'],
  ['[Research | Labs](https://example.com) | Engineer (2021 - 2022)', '[Research | Labs](https://example.com)', 'Engineer', '2021 – 2022'],
  [String.raw`Research \| Labs (2021 - 2022)`, String.raw`Research \| Labs`, '', '2021 – 2022'],
  ['`Research | Labs` | Engineer (2021 - 2022)', '`Research | Labs`', 'Engineer', '2021 – 2022'],
  ['[Research｜Labs](https://example.com/a|b)｜Engineer｜Lead (2021 - 2022)', '[Research｜Labs](https://example.com/a|b)', 'Engineer · Lead', '2021 – 2022'],
  ['Acme | [Engineer | Lead](https://example.com/a_(b|c)) (2021 - 2022)', 'Acme', '[Engineer | Lead](https://example.com/a_(b|c))', '2021 – 2022'],
  ['``Research `|` Labs`` ｜ Engineer | 2021 - 2022', '``Research `|` Labs``', 'Engineer', '2021 – 2022'],
  [String.raw`Research \\| Engineer (2021 - 2022)`, String.raw`Research \\`, 'Engineer', '2021 – 2022'],
  ['Research (Platform) | Engineer (2021 - 2022)', 'Research (Platform)', 'Engineer', '2021 – 2022'],
];
for (const [text, title, subtitle, date] of entries) {
  test(`entry: ${text}`, () => assert.deepEqual(parseEntryHeading(text), { title, subtitle, date }));
}
for (const text of ['指标口径治理', 'A | B', 'Projects (2)', '（2020 – 2021）', '2023 年度总结', 'Version 2 (beta)',
  '[Research | Labs (2021 - 2022)', '`Research | Labs (2021 - 2022)',
  '[Research](https://example.com/a|b (2021 - 2022)', String.raw`Research \| 2021 - 2022`]) {
  test(`not an entry: ${text}`, () => assert.equal(parseEntryHeading(text), null));
}
