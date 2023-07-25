The Openings Trainer is in the early stages of development, and isn’t really documented yet.

The program queries the Lichess Opening Explorer database for each board position, and plays moves based on how common they are.  For instance, if you play 1.e4, then the computer will have a 41% chance of playing 1...e5, an 18% chance of playing 1...c5, etc., which is how often those moves are played in the Lichess database.

The database has well over two billion games, so is a great way to tell what your opponents are likely to play.  This is as opposed to playing against a bot, which… well, plays like a bot.

## Online

The latest version is likely to be unstable, like the rest of this
project.  That said, you can access it at
https://github.piquan.org/opening-trainer/

## Running locally

To run the development server:

```bash
npm run dev -- -H localhost
```

Open [http://localhost:3000](http://localhost:3000) with your browser.
