var express = require('express');
var passport = require('passport');
var TwitterStrategy = require('passport-twitter');
var db = require('../db');


passport.use(new TwitterStrategy({
  consumerKey: process.env['TWITTER_CONSUMER_KEY'],
  consumerSecret: process.env['TWITTER_CONSUMER_SECRET'],
  callbackURL: '/oauth/callback/twitter',
  store: true
}, function verify(token, tokenSecret, profile, cb) {
  db.get('SELECT * FROM federated_credentials WHERE provider = ? AND subject = ?', [
    'https://twitter.com',
    profile.id
  ], function(err, row) {
    if (err) { return cb(err); }
    if (!row) {
      db.run('INSERT INTO users (name) VALUES (?)', [
        profile.displayName
      ], function(err) {
        if (err) { return cb(err); }
        var id = this.lastID;
        db.run('INSERT INTO federated_credentials (user_id, provider, subject) VALUES (?, ?, ?)', [
          id,
          'https://twitter.com',
          profile.id
        ], function(err) {
          if (err) { return cb(err); }
          var user = {
            id: id,
            name: profile.displayName
          };
          return cb(null, user);
        });
      });
    } else {
      db.get('SELECT * FROM users WHERE id = ?', [ row.user_id ], function(err, row) {
        if (err) { return cb(err); }
        if (!row) { return cb(null, false); }
        return cb(null, row);
      });
    }
  });
}));

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { id: user.id, username: user.username, name: user.name });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});


var router = express.Router();

router.get('/login', function(req, res, next) {
  res.render('login');
});

router.get('/login/federated/twitter', function(req, res, next) {
  var state = {
    display: req.query.display || 'page'
  };
  passport.authenticate('twitter', { state: state })(req, res, next);
});

router.get('/oauth/callback/twitter', passport.authenticate('twitter', {
  failWithError: true
}), function(req, res, next) {
  var url = '/';
  if (req.session && req.session.returnTo) {
    url = req.session.returnTo;
    delete req.session.returnTo;
  }
  var state = req.authInfo.state;
  switch (state.display) {
  case 'popup':
    return res.render('redirect', { returnTo: url });
  case 'page':
  default:
    return res.redirect(url);
  }
});

router.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

module.exports = router;
