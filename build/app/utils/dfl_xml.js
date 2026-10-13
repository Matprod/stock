function localName(tag) {
    const bare = tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag;
    return bare;
}
function parseAttrs(raw) {
    const attrs = {};
    const re = /([^\s=]+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = re.exec(raw)) !== null) {
        attrs[match[1]] = match[2];
    }
    return attrs;
}
export function parseXml(xml) {
    const root = { name: 'root', attrs: {}, children: [] };
    const stack = [root];
    const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?([^\s>/]+)([^>]*)>/g;
    let match;
    while ((match = re.exec(xml)) !== null) {
        const token = match[0];
        if (token.startsWith('<!--') || token.startsWith('<![CDATA['))
            continue;
        const tag = localName(match[1]);
        const rest = match[2] ?? '';
        const selfClosing = rest.trimEnd().endsWith('/') || token.endsWith('/>');
        const isClose = token.startsWith('</');
        if (isClose) {
            if (stack.length > 1)
                stack.pop();
            continue;
        }
        const attrs = parseAttrs(rest.replace(/\/\s*$/, ''));
        const node = { name: tag, attrs, children: [] };
        stack[stack.length - 1].children.push(node);
        if (!selfClosing)
            stack.push(node);
    }
    return root;
}
export function findAll(node, name) {
    const out = [];
    const walk = (n) => {
        if (n.name === name)
            out.push(n);
        for (const child of n.children)
            walk(child);
    };
    walk(node);
    return out;
}
export function findFirst(node, name) {
    if (node.name === name)
        return node;
    for (const child of node.children) {
        const found = findFirst(child, name);
        if (found)
            return found;
    }
    return null;
}
//# sourceMappingURL=dfl_xml.js.map