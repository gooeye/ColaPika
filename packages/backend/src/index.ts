import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Game Server Running' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
