import * as v from 'valibot';

const registerSchema = v.object(
    {
        password1: v.string([
            v.minLength(1, 'Please enter your password.'),
            v.minLength(8, 'Your password must have 8 characters or more.'),
        ]),
        password2: v.string(),
    },
    [
        v.forward(
            v.custom((input) => input.password1 === input.password2, 'The two passwords do not match.'),
            ['password2'],
        ),
    ],
);

export default registerSchema;
