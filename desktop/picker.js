const list = document.querySelector('#sources');
const status = document.querySelector('#status');
const confirm = document.querySelector('#confirm');
let sources = [], kind = 'screen', selected = null;
function render() {
  list.replaceChildren();
  const visible = sources.filter(source => source.kind === kind);
  status.textContent = visible.length ? `${visible.length} fonte(s) disponível(is)` : 'Nenhuma fonte disponível. Abra a janela desejada, deixe-a visível e atualize a lista.';
  for (const source of visible) {
    const button = document.createElement('button'); button.className = 'source'; button.type = 'button';
    button.setAttribute('aria-pressed', String(selected === source.id));
    const img = document.createElement('img'); img.src = source.preview; img.alt = '';
    const label = document.createElement('span'); label.textContent = source.name;
    button.append(img, label);
    button.onclick = () => { selected = source.id; confirm.disabled = false; for (const item of list.children) item.setAttribute('aria-pressed', String(item === button)); };
    list.append(button);
  }
  confirm.disabled = !selected;
}
async function refresh() {
  selected = null; confirm.disabled = true; list.replaceChildren(); status.textContent = 'Carregando fontes…';
  document.querySelector('#refresh').disabled = true;
  try { sources = await window.sourcePicker.list(); render(); }
  catch { sources = []; status.textContent = 'Não foi possível listar as fontes. Confira a permissão de gravação de tela e tente novamente.'; }
  finally { document.querySelector('#refresh').disabled = false; }
}
document.querySelectorAll('[data-kind]').forEach(button => button.onclick = () => {
  kind = button.dataset.kind; selected = null;
  document.querySelectorAll('[data-kind]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button))); render();
});
document.querySelector('#refresh').onclick = refresh;
document.querySelector('#cancel').onclick = () => window.sourcePicker.cancel();
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.sourcePicker.cancel(); });
confirm.onclick = async () => { if (!selected) return; confirm.disabled = true; try { await window.sourcePicker.choose(selected); } catch { status.textContent = 'A fonte não está mais disponível. Atualize a lista.'; } };
refresh();
