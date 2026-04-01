import { BrowserRouter } from "react-router-dom";
import AppRouter from "./src/routes/Approuter";

const App = () => {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
};

export default App;
