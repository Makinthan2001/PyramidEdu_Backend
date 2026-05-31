"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            }));
            res.status(422).json({
                success: false,
                message: 'Validation failed.',
                errors,
            });
            return;
        }
        req.body = result.data;
        next();
    };
}
