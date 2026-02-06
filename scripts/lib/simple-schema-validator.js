function getType(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
}

function validateNode(value, schema, path, errors) {
    if (!schema || typeof schema !== 'object') return;

    if (Array.isArray(schema.anyOf)) {
        const branchErrors = [];
        const isValid = schema.anyOf.some(branch => {
            const localErrors = [];
            validateNode(value, branch, path, localErrors);
            if (localErrors.length === 0) return true;
            branchErrors.push(localErrors);
            return false;
        });
        if (!isValid) {
            errors.push(`${path}: does not satisfy anyOf schemas`);
        }
        return;
    }

    if (Array.isArray(schema.oneOf)) {
        let validCount = 0;
        for (const branch of schema.oneOf) {
            const localErrors = [];
            validateNode(value, branch, path, localErrors);
            if (localErrors.length === 0) {
                validCount += 1;
            }
        }
        if (validCount !== 1) {
            errors.push(`${path}: must satisfy exactly one schema in oneOf`);
        }
        return;
    }

    if (schema.const !== undefined && value !== schema.const) {
        errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
        return;
    }

    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
        return;
    }

    if (schema.type) {
        const actualType = getType(value);
        if (actualType !== schema.type) {
            errors.push(`${path}: expected type "${schema.type}", got "${actualType}"`);
            return;
        }
    }

    if (schema.type === 'string') {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push(`${path}: string length must be >= ${schema.minLength}`);
        }
        if (schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(value)) {
                errors.push(`${path}: does not match pattern ${schema.pattern}`);
            }
        }
        return;
    }

    if (schema.type === 'array') {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            errors.push(`${path}: array length must be >= ${schema.minItems}`);
        }
        if (schema.items) {
            value.forEach((item, index) => {
                validateNode(item, schema.items, `${path}[${index}]`, errors);
            });
        }
        return;
    }

    if (schema.type === 'object') {
        const required = schema.required || [];
        for (const key of required) {
            if (!(key in value)) {
                errors.push(`${path}: missing required property "${key}"`);
            }
        }

        const properties = schema.properties || {};
        for (const [key, propSchema] of Object.entries(properties)) {
            if (key in value) {
                validateNode(value[key], propSchema, `${path}.${key}`, errors);
            }
        }

        if (schema.additionalProperties === false) {
            for (const key of Object.keys(value)) {
                if (!Object.prototype.hasOwnProperty.call(properties, key)) {
                    errors.push(`${path}: unexpected property "${key}"`);
                }
            }
        }
    }
}

function validateAgainstSchema(value, schema, path = '$') {
    const errors = [];
    validateNode(value, schema, path, errors);
    return errors;
}

module.exports = {
    validateAgainstSchema
};
