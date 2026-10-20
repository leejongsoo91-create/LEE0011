import NotionPage from '../components/NotionPage.jsx'
import HoldingsSection from '../components/HoldingsSection.jsx'

// 상단은 노션 에디터, 하단은 보유 종목 비중
export default function Investments() {
  return (
    <>
      <NotionPage name="Investments" columns={['종목명', '티커', '수량']} />
      <HoldingsSection />
    </>
  )
}
