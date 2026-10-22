// Deliberately explicit: romanized Korean/Japanese strings in dictionary fields
// must not silently become Mandarin neutral-tone syllables. Rare attested
// Mandarin extensions (biang, bong, din, fiao, len, wong, etc.) are retained.
export const syllables = new Set((
  "a ai an ang ao ba bai ban bang bao bei ben beng bi bian biang biao bie bin bing bo bong bu " +
  "ca cai can cang cao ce cei cen ceng cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo " +
  "da dai dan dang dao de dei den deng di dia dian diao die din ding diu dong dou du duan dui dun duo " +
  "e ê ei en eng er fa fan fang fei fen feng fiao fo fou fu ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo " +
  "ha hai han hang hao he hei hen heng hm hng hong hou hu hua huai huan huang hui hun huo " +
  "ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo " +
  "la lai lan lang lao le lei len leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lv lvan lve " +
  "m ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu " +
  "n na nai nan nang nao ne nei nen neng ng ni nia nian niang niao nie nin ning niu nong nou nu nuan nui nun nuo nv nve " +
  "o ou pa pai pan pang pao pei pen peng pi pia pian piao pie pin ping po pou pu qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun " +
  "r ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo " +
  "sa sai san sang sao se sei sen seng sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo gue " +
  "ta tai tan tang tao te tei teng ti tian tiao tie ting tong tou tu tuan tui tun tuo wa wai wan wang wei wen weng wo wong wu " +
  "xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun ya yai yan yang yao ye yi yin ying yo yong you yu yuan yue yun " +
  "za zai zan zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo zi zong zou zu zuan zui zun zuo"
).split(" "));

/** Numeric tones: 1–4; 5 = unmarked/neutral. ü → v, ê is preserved. */
export function toNumeric(input: string): string {
  let text = input.trim().toLowerCase().replaceAll("u:", "ü").replaceAll("ɡ", "g").replaceAll("ɑ", "a");
  let explicit = text.match(/[0-5]$/)?.[0];
  if (explicit) text = text.slice(0, -1);
  let tone = 0;
  let base = "";
  const marks: Record<string, number> = { "\u0304": 1, "\u0301": 2, "\u030c": 3, "\u0300": 4 };
  for (const ch of text.normalize("NFD")) {
    if (marks[ch]) {
      if (tone) throw new Error(`Multiple tone marks: ${input}`);
      tone = marks[ch];
    } else if (ch === "\u0308") {
      if (!base.endsWith("u")) throw new Error(`Invalid diaeresis: ${input}`);
      base = base.slice(0, -1) + "v";
    } else if (ch === "\u0302") {
      if (!base.endsWith("e")) throw new Error(`Invalid circumflex: ${input}`);
      base = base.slice(0, -1) + "ê";
    } else {
      base += ch;
    }
  }
  if (!/^[a-zê]+$/.test(base) || /^(xxx|xx|unknown|null|none)$/.test(base)) {
    throw new Error(`Invalid pinyin: ${input}`);
  }
  // Reject unsegmented polysyllabic strings; keep unusual attested monosyllables.
  if (base.length > 7) throw new Error(`Unsegmented reading: ${input}`);
  if (!syllables.has(base)) throw new Error(`Unrecognized Mandarin syllable: ${input}`);
  if (explicit && tone && Number(explicit) !== tone) throw new Error(`Conflicting tones: ${input}`);
  return `${base}${tone || (explicit ? Number(explicit) || 5 : 5)}`;
}

/** A rare polysyllabic character is one reading: 千瓦合字 → qian1-wa3. */
export function toNumericReading(input: string): string {
  try { return toNumeric(input); } catch (originalError) {
    const chars = [...input.trim().toLowerCase().normalize("NFC")];
    const countTones = (text: string) => [...text.normalize("NFD")].filter(ch => /[\u0300\u0301\u0304\u030c]/u.test(ch)).length;
    if (countTones(input) < 2) throw originalError;
    const solutions: string[][] = [];
    function visit(start: number, parts: string[]) {
      if (start === chars.length) { solutions.push(parts); return; }
      for (let end = start + 1; end <= chars.length; end++) {
        const part = chars.slice(start, end).join("");
        if (countTones(part) !== 1) continue;
        try { visit(end, [...parts, toNumeric(part)]); } catch { /* Try the next syllable boundary. */ }
      }
    }
    visit(0, []);
    const unique = [...new Set(solutions.map(parts => parts.join("-")))];
    if (unique.length !== 1) throw new Error(`Ambiguous/unsupported polysyllabic reading: ${input}`);
    return unique[0];
  }
}

export function toCnsNumeric(input: string): string {
  const hasTone = /[0-5]$/.test(input) || /[\u0300\u0301\u0304\u030c]/.test(input.normalize("NFD"));
  return toNumericReading(hasTone ? input : input + "1");
}

export function codepoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function parseRange(text: string): [number, number] {
  const [start, end = start] = text.trim().split("..");
  return [parseInt(start, 16), parseInt(end, 16)];
}
