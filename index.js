$(function() {

    $(".section").hide();

    $(".collapse")
    .css("text-decoration", "underline")
    .click(function() {
    
        var $section = $(this).next();
        
        if ($section.css("display") === "block") {
            $section.hide("slow");   
        }
        else {
            $section.show("fast");
        }
    
    });

});