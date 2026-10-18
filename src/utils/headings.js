// 에디터 문서에서 H1~H3 제목만 뽑아 목차용 목록으로 만든다.
export function extractHeadings(blocks) {
  return blocks
    .filter((block) => block.type === 'heading')
    .map((block) => ({
      id: block.id,
      level: block.props.level,
      text: block.content.map((item) => item.text ?? '').join(''),
    }))
    .filter((heading) => heading.text.trim() !== '')
}
