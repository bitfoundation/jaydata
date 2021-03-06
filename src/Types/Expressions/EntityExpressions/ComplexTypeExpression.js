import $data, { $C, Guard, Container, Exception } from '../../../TypeSystem/index.js';

$C('$data.Expressions.ComplexTypeExpression', $data.Expressions.ExpressionNode, null, {
    constructor: function (source, selector) {
        ///<signature>
        ///<param name="source" type="$data.Expressions.EntityExpression" />
        ///<param name="selector" type="$data.Expressions.MemberInfoExpression" />
        ///</signature>
        ///<signature>
        ///<param name="source" type="$data.Expressions.ComplexTypeExpression" />
        ///<param name="selector" type="$data.Expressions.MemberInfoExpression" />
        ///</signature>
        Guard.requireType("source", source, [$data.Expressions.EntityExpression, $data.Expressions.ComplexTypeExpression]);
        Guard.requireType("selector", selector, [$data.Expressions.EntityExpression, $data.Expressions.MemberInfoExpression]);
        this.source = source;
        this.selector = selector;
        var memDef = source.entityType.getMemberDefinition(selector.memberName);
        var dt = memDef.elementType || memDef.dataType;
        var t = Container.resolveType(dt);
        this.entityType = t;
    },

    getMemberDefinition: function (name) {
        return this.entityType.getMemberDefinition(name);
    },

    nodeType: { value: $data.Expressions.ExpressionType.Com }
});

export default $data
