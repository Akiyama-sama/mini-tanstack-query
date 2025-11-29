import './App.css'
import { useQuery } from './tanstack-query'
interface Todo {
  id:number
  todo:string
  completed:boolean
  useId:number
}
function App() {
  const {status ,error, data } = useQuery<Todo>(['todoListGet'],()=>{
   return new Promise<Todo>((resolve) => {
     setTimeout(() => {
       fetch("https://dummyjson.com/todos/1")
         .then(res => res.json())
         .then(data => resolve(data));
     }, 1000);
   });
  })

  if(status  == 'loading'){
    return <>loading</>
  }
  if(status == 'error'){
    return <>error, {error}</>
  }
  return (
    <>
      This is a query Test
      <br />
      {JSON.stringify(data)}
    </>
  )
}

export default App
