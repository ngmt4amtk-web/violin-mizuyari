# yubi.src.html と app.html・mame.html に detector.js・tane.js をそのまま埋め込む
import re, pathlib
here = pathlib.Path(__file__).parent
det = (here/'detector.js').read_text(encoding='utf-8')
tane = (here/'tane.js').read_text(encoding='utf-8')
src = (here/'yubi.src.html').read_text(encoding='utf-8')
assert src.count('/*@detector*/') == 1 and src.count('/*@tane*/') == 1
out = src.replace('/*@detector*/\n', det).replace('/*@tane*/\n', tane)
(here/'yubi.html').write_text(out, encoding='utf-8')
app = (here/'app.html').read_text(encoding='utf-8')
i = app.index('<script>\n') + len('<script>\n'); j = app.index('</script>', i)
app = app[:i] + det + '\n' + app[j:]
(here/'app.html').write_text(app, encoding='utf-8')
mame = (here/'mame.html').read_text(encoding='utf-8')
i = mame.index('<script>\n') + len('<script>\n'); j = mame.index('</script>', i)
mame = mame[:i] + det + '\n' + mame[j:]
(here/'mame.html').write_text(mame, encoding='utf-8')
print('ok')
