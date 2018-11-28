// load all the things we need
const LocalStrategy = require('passport-local').Strategy;

// load up the user model
const User = require('./models/user');

//load the crypto module.
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fse = require('fs-extra');
const path = require('path');

const uuidV1 = require('uuid/v1');

module.exports = function (passport) {

	// =========================================================================
	// passport session setup ==================================================
	// =========================================================================
	// required for persistent login sessions
	// passport needs ability to serialize and unserialize users out of session

	// used to serialize the user for the session
	passport.serializeUser(function (user, done) {
		done(null, user.id);
	});

	// used to deserialize the user
	passport.deserializeUser(function (id, done) {
		User.findById(id, function (err, user) {
			done(err, user);
		});
	});

	// =========================================================================
	// LOCAL LOGIN =============================================================
	// =========================================================================
	passport.use('user-sign-in', new LocalStrategy({
		// by default, local strategy uses username and password, we will override with email
		usernameField: 'email',
		passwordField: 'password',
		passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
	},
		function (req, email, password, done) {
			if (email)
				email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching
			// asynchronous
			process.nextTick(function () {
				User.findOne({ 'email': email }, function (err, user) {
					// if there are any errors, return the error
					if (err)
						return done(err);

					// if no user is found, return the message
					if (!user)
						return done(null, false, { verified: true, message: 'No user found.' });

					if (!user.validPassword(password))
						return done(null, false, { verified: true, message: 'Oops! Wrong password.' });

					if (!user.isEmailConfirmed()) {
						return done(null, false, { email: user.email, verified: false, message: 'Your email has not been confirmed yet.' });
					}
					// all is well, return user
					else
						return done(null, user);
				});
			});

		}));

	// =========================================================================
	// LOCAL SIGNUP ============================================================
	// =========================================================================
	passport.use('user-sign-up', new LocalStrategy({
		// by default, local strategy uses username and password, we will override with email
		usernameField: 'email',
		passwordField: 'password',
		passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
	},
		function (req, email, password, done) {
			if (email)
				email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching

			// asynchronous
			process.nextTick(function () {
				// if the user is not already logged in:
				if (!req.user) {
					User.findOne({ 'email': email }, function (err, user) {
						// if there are any errors, return the error
						if (err)
							return done(err);

						// check to see if theres already a user with that email
						if (user) {
							return done(null, false, { success: false, message: 'That email is already taken.' });
						} else {

							fse.mkdirs(path.join(rootDir, "/uploads/users/" + email), function (err) {
								if (err) {
									console.log(err);
								} else {
									console.log('upload folder succesfully created');
								}
							});

							const emailHash = crypto.randomBytes(20).toString("hex");
							// create the user
							const newUser = new User();

							newUser.email = email;
							newUser.password = newUser.generateHash(password);
							newUser.name = req.body.name;
							newUser.birthday = req.body.birthday;
							newUser.gender = req.body.gender;
						
							newUser.emailConfirmed = false;
							newUser.emailConfirmationToken = emailHash;

							newUser.save(function (err) {
								if (err)
									return done(err);

								const smtpTransport = nodemailer.createTransport({
									service: 'gmail',
									auth: {
										user: 'fviclass@gmail.com',
										pass: 'fviclass2017'
									}
								});
								const mailOptions = {
									to: email,
									from: 'Email Confirmation',
									subject: 'Verification Code',
									html: 'Please click in the link below to confirm your email:\n\n' +
										'http://' + req.headers.host +'/user-email-confirmation/' + emailHash + '\n\n' +
										'Verification Code: ' + emailHash
								};

								smtpTransport.sendMail(mailOptions);

								//Sets it to a failure to redirect the user to the login page.
								return done(null, newUser, { email: email, success: true, message: 'An email has been sent to ' + email + ' for confirmation.' });
							});
						}

					});

				}
				else {
					// user is logged in and already has a local account. Ignore signup. (You should log out before trying to create a new account, user!)
					return done(null, req.user);
				}

			});

		}));

	// =========================================================================
	// LOCAL UPDATE ============================================================
	// =========================================================================
	passport.use('user-update', new LocalStrategy({
		// by default, local strategy uses username and password, we will override with email
		usernameField: 'username',
		passwordField: 'password',
		passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
	},
		function (req, username, password, done) {
			if (username)
				username = username.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching

			// asynchronous
			process.nextTick(function () {
				User.findOne({ 'email': username }, function (err, user) {
					// if there are any errors, return the error
					if (err)
						return done(err);

					// if no user is found, return the message
					if (!user)
						return done(null, false, { success: false, message: 'No user found.' });

					if (!user.validPassword(password))
						return done(null, false, { success: false, message: 'Oops! Wrong password.' });

					// all is well, return user
					else if (req.body.email !== username) {

						const email = req.body.email;
						const emailHash = crypto.randomBytes(20).toString("hex");

						User.findOne({ 'email': email }, function (err, userExists) {
							if (err)
								return done(err);
							// if no user is found, return the message
							if (!userExists) {

								if (req.body.newPassword !== '' && req.body.newPasswordConfirmation !== '') {
									const newPassword = req.body.newPassword;
									console.log(newPassword);
									user.password = user.generateHash(newPassword);
								}

								user.email = req.body.email;
								user.name = req.body.name;
								user.birthday = req.body.birthday;
								user.gender = req.body.gender;

								user.emailConfirmed = false;
								user.emailConfirmationToken = emailHash;

								user.save(function (err) {
									if (err)
										return done(err);

									const smtpTransport = nodemailer.createTransport({
										service: 'gmail',
										auth: {
											user: 'fviclass@gmail.com',
											pass: 'fviclass2017'
										}
									});
									
									const mailOptions = {
										to: email,
										from: 'Email Confirmation',
										subject: 'Verification Code',
										html: 'Please click in the link below to confirm your email:\n\n' +
											'https://mapper.tangomangosystem.com/user-email-confirmation/' + emailHash + '\n\n' +
											'Verification Code: ' + emailHash
									};

									smtpTransport.sendMail(mailOptions);

									return done(null, false, { newEmail: email, success: true, message: 'A confirmation email has been sent to ' + email });
								});
							}
							else {
								return done(null, false, { success: false, message: 'That email is already taken.' });
							}
						});
					}
					else {
						if (req.body.newPassword !== '' && req.body.newPasswordConfirmation !== '') {
							const newPassword = req.body.newPassword;
							console.log(newPassword);
							if (req.body.newPassword === req.body.newPasswordConfirmation) {
								user.password = user.generateHash(newPassword);
							}
							else {
								return done(null, false, { success: false, message: 'Make sure you type the same exact password in both inputs.' });
							}
						}

						user.name = req.body.name;

						user.save(function (err) {
							if (err)
								return done(err);
							
							return done(null, false, { success: true, newPassword: true, message: 'Your account has been updated.' });
						});
					}

				});

			});
		}));
};