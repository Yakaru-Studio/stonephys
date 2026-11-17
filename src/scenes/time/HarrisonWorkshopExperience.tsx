import HistoricalScenePlayer from '../HistoricalScenePlayer'
import { harrisonWorkshop } from './harrisonWorkshop'

export default function HarrisonWorkshopExperience({ onExit }: { onExit: () => void }) {
  return <HistoricalScenePlayer scene={harrisonWorkshop} onExit={onExit}/>
}
