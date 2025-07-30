import ImageViewMag from './components/ImageView/ImageViewMag'

function App() {

  return (
      <div className="flex items-center justify-center w-screen h-screen">
        <div className="w-[50vw] h-[50vh] flex items-center justify-center bg-gray-100 rounded shadow translate-x-[-50%] translate-y-[-50%] absolute left-1/2 top-1/2">
          <ImageViewMag />
        </div>
      </div>
  )
}

export default App
