using Microsoft.AspNetCore.Mvc;
using OtoServis.Api.Services;

namespace OtoServis.Api.Controllers;

public static class PlanExceptionExtensions
{
    public static ActionResult ToActionResult(this PlanFeatureDeniedException ex)
        => new ObjectResult(new { error = ex.Message, code = ex.Code, feature = ex.Feature })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };

    public static ActionResult ToActionResult(this PlanLimitExceededException ex)
        => new ObjectResult(new { error = ex.Message, code = ex.Code })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
}
