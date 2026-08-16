const { name, type } = $arguments;
let s = $files[0];

// 1. 拉取订阅节点列表并去掉无用字段
let p = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? "collection" : "subscription",
  platform: "ClashMeta",
  produceType: "internal"
});
p = p.map(x => {
  delete x._subName;
  delete x._subDisplayName;
  return x;
});

// 2. 把订阅节点追加到已有 proxies 段末尾（proxy-groups 之前）
function toYaml(obj, indent = "    ", isFirstPrefix = "  - ") {
  let lines = [];
  let isFirst = true;
  for (let [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    let prefix = isFirst ? isFirstPrefix : indent;
    isFirst = false;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      lines.push(`${prefix}${k}:`);
      let sub = toYaml(v, indent + "  ", indent + "  ");
      if (sub) lines.push(sub);
    } else if (Array.isArray(v)) {
      lines.push(`${prefix}${k}: [${v.map(i => JSON.stringify(i)).join(", ")}]`);
    } else {
      lines.push(`${prefix}${k}: ${JSON.stringify(v)}`);
    }
  }
  return lines.join("\n");
}
let e = p.map(x => toYaml(x)).join("\n\n");
s = s.replace(/(?=^proxy-groups:)/m, `${e}\n\n`);

// 3. 追加分组成员名，并只排除含有dialer-proxy的节点进“中继前置”组
let all = p.map(x => x.name);
let r = p.filter(x => !x["dialer-proxy"]).map(x => x.name);
let noFree = p.filter(x => !/免费/.test(x.name)).map(x => x.name);
// 仅注入名称明确标为新加坡/狮城/SG/Singapore 的节点。
let singapore = p.filter(x => /(?:新加坡|狮城|Singapore|(?:^|[^A-Za-z])SG(?:$|[^A-Za-z]))/i.test(x.name)).map(x => x.name);

s = s.replace(
  /^(\s{2}- name:[\s\S]*?)\s{4}proxies:\s*\[([^\]]*)\]/gm,
  (m, head, body) => {
    let ex = body.split(",").map(x => x.trim()).filter(Boolean);
    // 精确提取分组名
    let groupMatch = head.match(/- name:\s*([^\n]+)/);
    let groupName = groupMatch ? groupMatch[1].trim() : "";

    let add = all;
    if (groupName === "Relay") add = r;
    else if (groupName.includes("self-auto")) add = noFree;
    else if (groupName === "狮城自动") add = singapore;

    let merged = [...new Set([...ex, ...add])];
    return `${head}    proxies: [${merged.join(", ")}]`;
  }
);

$content = s;
